import express from 'express'
import AptR from './apartment'
import cleanerR from './cleaner'
import ManagerR from './manager'
import AptManR from './aptMan'

const ManagerRouter = express.Router()

ManagerRouter.use('', AptR)
ManagerRouter.use('', ManagerR)
ManagerRouter.use('', cleanerR)
ManagerRouter.use('', AptManR)

export default ManagerRouter
