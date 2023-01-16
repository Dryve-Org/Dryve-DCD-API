import express from 'express'
import AptR from './apartment'
import cleanerR from './cleaner'
import ManagerR from './manager'

const ManagerRouter = express.Router()

ManagerRouter.use('', AptR)
ManagerRouter.use('', ManagerR)
ManagerRouter.use('', cleanerR)

export default ManagerRouter
