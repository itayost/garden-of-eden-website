---
name: deploy
description: Build, type-check, and deploy to Vercel production with pre-flight validation
disable-model-invocation: true
---

# Deploy to Production

Run a full pre-flight check and deploy to Vercel production.

## Steps

1. **Type check**: Run `npx tsc --noEmit`. Stop immediately if there are errors.
2. **Build**: Run `npm run build`. Stop immediately if it fails.
3. **Deploy**: Run `vercel --prod` and report the deployment URL when done.

If any step fails, report the error clearly and do NOT continue to the next step.
