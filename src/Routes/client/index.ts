import express from 'express'
import userRouter from './user'
import orderR from './order'
import driverR from './driver'
import cleanerR from './cleaner'
import preferencesR from './preferences'

const clientRouter = express.Router()

clientRouter.use('', userRouter)
clientRouter.use('', orderR)
clientRouter.use('', driverR)
clientRouter.use('', cleanerR)
clientRouter.use('', preferencesR)


export default clientRouter