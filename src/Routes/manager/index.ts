import express from 'express'
import AptR from './apartment'
import cleanerR from './cleaner'
import ManagerR from './manager'
import AptManR from './aptMan'
import cleanerProR from './cleanerPro'
import MasterR from './master'
import SapR from './servicesAndProducts'
import ClientR from './client'

const ManagerRouter = express.Router()

ManagerRouter.use('', SapR)
ManagerRouter.use('', AptR)
ManagerRouter.use('', ManagerR)
ManagerRouter.use('', cleanerR)
ManagerRouter.use('', AptManR)
ManagerRouter.use('', cleanerProR)
ManagerRouter.use('', MasterR)
ManagerRouter.use('', ClientR)

export default ManagerRouter
