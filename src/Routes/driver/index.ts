import express from 'express'
import aptR from './apartment'
import cleanerR from './cleaner'
import driverR from './driver'
import orderR from './order2'

const driverRouter = express.Router()

driverRouter.use('', aptR)
driverRouter.use('', orderR)
driverRouter.use('', driverR)
driverRouter.use('', cleanerR)

export default driverRouter