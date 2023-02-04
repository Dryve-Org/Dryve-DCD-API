import express, { Request, Response } from 'express'
import AptManR from './aptMan'
import AptR from './apartment'

const aptManRouter = express.Router()

aptManRouter.use('', AptManR)
aptManRouter.use('/apt', AptR)

export default aptManRouter