# cf_ai_chat

This is a complete Cloudflare AI-powered chat application built for the AI assignment.

## Live Demo
The application is deployed and currently live at: **[https://cf_ai_chat.shubhamsinghaltamu.workers.dev](https://cf_ai_chat.shubhamsinghaltamu.workers.dev)**


## Components Used
- **LLM**: Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
- **Workflow / coordination**: Cloudflare Workers (Hono framework for API routing)
- **User input**: Cloudflare Workers Static Assets (serving a Vanilla JS + HTML/CSS UI, acts exactly like Pages)
- **Memory or state**: Cloudflare D1 (Serverless SQLite) to persistently store chat sessions and messages

## Prerequisites
- Node.js (v18+)
- npm

## Running Locally

1. Install dependencies:
   ```sh
   npm install
   ```

2. Initialize the local D1 database:
   ```sh
   npm run db:init
   ```

3. Start the local development server:
   ```sh
   npm run dev
   ```

4. Open your browser to `http://localhost:8787` to interact with the assignment!

## Deployment (Optional)
To deploy this project to your Cloudflare account, follow these steps:
1. Authenticate with Wrangler: `npx wrangler login`
2. Create a remote D1 database: `npx wrangler d1 create chat_db`
3. Update `wrangler.toml` with the newly generated `database_id`.
4. Run remote database migrations: `npx wrangler d1 execute chat_db --remote --file=./schema.sql`
5. Deploy the application: `npm run deploy`
