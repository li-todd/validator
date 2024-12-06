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

// Validation schemas
const postSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
})

const validateRequestSchema = z.object({
  id: z.string().min(1),
  salt: z.string().min(6),
})

const app = new Hono()

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
  const data = c.req.valid('json') as ValidateRequest
  
  try {
    // Simply return the validated request data
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

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    ok: true, 
    status: 'healthy',
    version: '1.0.0'
  })
})

export default app
