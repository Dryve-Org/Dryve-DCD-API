import express from 'express'
import MasterR from './master'
import AptR from './apt'
import ManagerR from './manager'

const adminRouter = express.Router()

adminRouter.use('/master', MasterR)
adminRouter.use('/apt', AptR)
adminRouter.use('/manager', ManagerR)

export default adminRouter