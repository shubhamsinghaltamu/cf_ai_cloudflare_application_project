import { Hono } from 'hono'

export interface Env {
  // @ts-ignore
  AI: any;
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>()

app.post('/api/chat', async (c) => {
  const { sessionId, message } = await c.req.json()
  const db = c.env.DB
  
  // Create session if not exists
  await db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').bind(sessionId).run()
  
  // Save user message
  await db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
    .bind(sessionId, 'user', message).run()
    
  // Fetch chat history
  const { results: history } = await db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all()
  
  // Format for AI
  const aiMessages = [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    //@ts-ignore
    ...history.map(m => ({ role: m.role, content: m.content }))
  ]
  
  // Call Workers AI
  const response = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: aiMessages
  })
  
  // Save AI response
  // @ts-ignore
  const aiContent = response.response
  await db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
    .bind(sessionId, 'assistant', aiContent).run()
    
  return c.json({ response: aiContent })
})

app.get('/api/history/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const { results } = await c.env.DB.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all()
  return c.json(results)
})

app.get('/api/sessions', async (c) => {
  // Fetch sessions, ordering by most recent creation or most recent message (simplest is created_at desc)
  const { results } = await c.env.DB.prepare(
    'SELECT id, created_at, IFNULL(pinned, 0) as pinned FROM sessions ORDER BY pinned DESC, created_at DESC'
  ).all()
  
  // To get a title, we might just use the session ID or fetch the first user message.
  // For simplicity, we just return the session IPs and let the frontend show them.
  // We can do a join to get the first message as the title!
  const sessionsWithTitles = await Promise.all(results.map(async (sess: any) => {
    const { results: msgs } = await c.env.DB.prepare(
      'SELECT content FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at ASC LIMIT 1'
    ).bind(sess.id, 'user').all()
    
    return {
      id: sess.id,
      title: msgs.length > 0 ? msgs[0].content : 'New Conversation',
      created_at: sess.created_at,
      pinned: sess.pinned === 1
    }
  }))
  
  return c.json(sessionsWithTitles)
})

app.delete('/api/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  await c.env.DB.prepare('DELETE FROM messages WHERE session_id = ?').bind(sessionId).run()
  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  return c.json({ success: true })
})

app.put('/api/sessions/:sessionId/pin', async (c) => {
  const sessionId = c.req.param('sessionId')
  const { pinned } = await c.req.json()
  await c.env.DB.prepare('UPDATE sessions SET pinned = ? WHERE id = ?').bind(pinned ? 1 : 0, sessionId).run()
  return c.json({ success: true })
})

export default app
