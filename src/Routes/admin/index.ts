import express from 'express'
import MasterR from './master'
import AptR from './apt'
import ManagerR from './manager'
import CleanerR from './cleaner'

const adminRouter = express.Router()

adminRouter.use('/master', MasterR)
adminRouter.use('/apt', AptR)
adminRouter.use('/manager', ManagerR)
adminRouter.use('/cleaner', CleanerR)

export default adminRouter