import express from 'express'
import MasterR from './master'
import AptR from './apt'

const adminRouter = express.Router()

adminRouter.use('/master', MasterR)
adminRouter.use('/apt', AptR)

export default adminRouter