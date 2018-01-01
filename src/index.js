const Koa = require('koa')
const app = new Koa()

const json = require('koa-json')
const compress = require('koa-compress')
const logger = require('koa-logger')
const responseTime = require('koa-response-time')
const Router = require('koa-router')
const error = require('koa-json-error')
const conditional = require('koa-conditional-get')
const etag = require('koa-etag')
const session = require('koa-session')
const ratelimit = require('koa-ratelimit')
const redisStore = require('koa-redis')

const Redis = require('ioredis')
const redis = new Redis()

const chalk = require('chalk')
const _ = require('lodash')

// x-response-time
// use this first
// https://github.com/koajs/response-time
app.use(responseTime())

// Error handler
app.use(
  error({
    preFormat: err => {
      // Log to rollbar or something
      return Object.assign({}, err)
    },
    postFormat: (e, obj) =>
      process.env.NODE_ENV === 'production' ? _.omit(obj, 'stack') : obj
  })
)

// json
app.use(json())

// compress
// https://github.com/koajs/compress
app.use(
  compress({
    filter: function(content_type) {
      return /text/i.test(content_type)
    },
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
  })
)

// logger
app.use(logger())

// etag works together with conditional-get
// use it upstream from etag so
// that they are present

app.use(conditional())

// add etags

app.use(etag())

app.keys = ['some secret key']

// session
// https://github.com/koajs/session
app.use(
  session(
    {
      key: 'app:sess',
      store: redisStore({})
    },
    app
  )
)

// Rate Limit
// https://github.com/koajs/ratelimit
app.use(
  ratelimit({
    db: redis,
    duration: 60000,
    errorMessage: 'Sometimes You Just Have to Slow Down.',
    id: ctx => ctx.ip,
    headers: {
      remaining: 'Rate-Limit-Remaining',
      reset: 'Rate-Limit-Reset',
      total: 'Rate-Limit-Total'
    },
    max: 100
  })
)

// Routes
const router = new Router()

router.get('/', async ctx => {
  let n = ctx.session.views || 0
  ctx.session.views = ++n
  console.log('session: ', ctx.session)
  ctx.body = {
    nice: 'job dude',
    ip: ctx.ip
  }
})

router.get('/404', async ctx => {
  ctx.throw(404, 'not found')
})

router.get('/500', async ctx => {
  ctx.throw(500, 'bad implementation.')
})

router.get('/error', async ctx => {
  hi()
})

app.use(router.routes())
app.use(
  router.allowedMethods({
    throw: true,
    notImplemented: () => {
      console.log('not implemented')
    },
    methodNotAllowed: () => {
      console.log('not allowed')
    }
  })
)

// app.on('error', (err, ctx) => {
//   console.error('--- IM THE HANDLER ---')
//   // console.log(ctx)
// })

app.listen(3000, () => {
  console.log(chalk.greenBright('🚀 get this shit started on port 3000'))
})

module.exports = app
