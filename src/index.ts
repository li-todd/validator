import { Hono } from 'hono'
import { z } from 'zod'
import { cors } from 'hono/cors'
import { validator } from 'hono/validator'

// Types
interface Post {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface ValidateRequest {
  id: string
  salt: string
}

interface ValidateResponse {
  ok: boolean
  message?: string
  errors?: any[]
  data?: any
}

interface Bindings {
  RCX_VALIDATOR: KVNamespace
}

// Validation schemas
const postSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
})

const validateRequestSchema = z.object({
  id: z.string().min(1),
  salt: z.string().min(6),
})

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', cors())

// Error handler
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({
    ok: false,
    message: err.message,
  }, 500)
})

// CRUD Routes
// Create
app.post('/posts', validator('json', (value, c) => {
  const parsed = postSchema.safeParse(value)
  if (!parsed.success) {
    return c.json({ 
      ok: false, 
      message: 'Invalid input',
      errors: parsed.error.errors 
    }, 400)
  }
  return parsed.data
}), async (c) => {
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const post: Post = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  try {
    // In production, you would use: await c.env.YOUR_KV.put(id, JSON.stringify(post))
    return c.json({ ok: true, post }, 201)
  } catch (error) {
    return c.json({ ok: false, message: 'Failed to create post' }, 500)
  }
})

// Read (Get all)
app.get('/posts', async (c) => {
  try {
    // In production: const posts = await c.env.YOUR_KV.list()
    return c.json({ ok: true, posts: [] })
  } catch (error) {
    return c.json({ ok: false, message: 'Failed to fetch posts' }, 500)
  }
})

// Read (Get one)
app.get('/posts/:id', async (c) => {
  const id = c.req.param('id')
  try {
    // In production: const post = await c.env.YOUR_KV.get(id)
    // if (!post) return c.json({ ok: false, message: 'Post not found' }, 404)
    return c.json({ ok: true, post: null })
  } catch (error) {
    return c.json({ ok: false, message: 'Failed to fetch post' }, 500)
  }
})

// Update
app.put('/posts/:id', validator('json', (value, c) => {
  const parsed = postSchema.safeParse(value)
  if (!parsed.success) {
    return c.json({ 
      ok: false, 
      message: 'Invalid input',
      errors: parsed.error.errors 
    }, 400)
  }
  return parsed.data
}), async (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json')
  
  try {
    // In production:
    // const existing = await c.env.YOUR_KV.get(id)
    // if (!existing) return c.json({ ok: false, message: 'Post not found' }, 404)
    
    const updatedPost: Post = {
      id,
      ...data,
      createdAt: new Date().toISOString(), // In production, keep the original createdAt
      updatedAt: new Date().toISOString(),
    }
    
    // await c.env.YOUR_KV.put(id, JSON.stringify(updatedPost))
    return c.json({ ok: true, post: updatedPost })
  } catch (error) {
    return c.json({ ok: false, message: 'Failed to update post' }, 500)
  }
})

// Delete
app.delete('/posts/:id', async (c) => {
  const id = c.req.param('id')
  try {
    // In production:
    // const existing = await c.env.YOUR_KV.get(id)
    // if (!existing) return c.json({ ok: false, message: 'Post not found' }, 404)
    // await c.env.YOUR_KV.delete(id)
    return c.json({ ok: true, message: 'Post deleted successfully' })
  } catch (error) {
    return c.json({ ok: false, message: 'Failed to delete post' }, 500)
  }
})

// Organization-based validation endpoint
app.post('/api/:org/req-validate', validator('json', (value, c) => {
  const parsed = validateRequestSchema.safeParse(value)
  if (!parsed.success) {
    return c.json({ 
      ok: false, 
      message: 'Invalid input',
      errors: parsed.error.errors 
    }, 400)
  }
  return parsed.data
}), async (c) => {
  const org = c.req.param('org')
  const data = c.req.valid('json') as ValidateRequest
  
  try {
    // Store the request in KV with a unique key
    const timestamp = new Date().toISOString()
    const key = `${org}:${data.id}:${timestamp}`
    
    await c.env.RCX_VALIDATOR.put(key, JSON.stringify({
      org,
      ...data,
      timestamp
    }))

    // Return the original request format
    return c.json({
      id: data.id,
      salt: data.salt
    })
  } catch (error) {
    return c.json({ 
      ok: false, 
      message: 'Validation failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, 500)
  }
})

// Get validation requests for an organization
app.get('/api/:org/req-validate', async (c) => {
  const org = c.req.param('org')
  
  try {
    const list = await c.env.RCX_VALIDATOR.list({ prefix: `${org}:` })
    // Get the most recent request
    if (list.keys.length > 0) {
      const latestKey = list.keys[list.keys.length - 1]
      const value = await c.env.RCX_VALIDATOR.get(latestKey.name)
      if (value) {
        const data = JSON.parse(value)
        // Return in same format as POST request
        return c.json({
          id: data.id,
          salt: data.salt
        })
      }
    }
    
    // Return 404 if no data found
    return c.json({
      ok: false,
      message: `No data found for organization: ${org}`,
      errors: ['Organization not found']
    }, 404)
  } catch (error) {
    return c.json({ 
      ok: false, 
      message: 'Failed to fetch request',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, 500)
  }
})

// Delete validation request for an organization
app.delete('/api/:org/req-validate', validator('json', (value, c) => {
  const parsed = validateRequestSchema.safeParse(value)
  if (!parsed.success) {
    return c.json({ 
      ok: false, 
      message: 'Invalid input',
      errors: parsed.error.errors 
    }, 400)
  }
  return parsed.data
}), async (c) => {
  const org = c.req.param('org')
  const data = c.req.valid('json') as ValidateRequest
  
  try {
    // Find the entry with matching org and id
    const list = await c.env.RCX_VALIDATOR.list({ prefix: `${org}:${data.id}:` })
    
    if (list.keys.length > 0) {
      // Delete all matching entries
      await Promise.all(
        list.keys.map(key => c.env.RCX_VALIDATOR.delete(key.name))
      )
      
      // Return the deleted request data
      return c.json({
        id: data.id,
        salt: data.salt
      })
    }
    
    // Return 404 if no matching data found
    return c.json({
      ok: false,
      message: `No data found for organization: ${org}`,
      errors: ['Organization not found']
    }, 404)
  } catch (error) {
    return c.json({ 
      ok: false, 
      message: 'Failed to delete request',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, 500)
  }
})

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    ok: true, 
    status: 'healthy',
    version: '1.0.0'
  })
})

export default app
