import express, { Request, Response } from 'express'
import AptManR from './aptMan'

const aptManRouter = express.Router()

aptManRouter.use('', AptManR)

export default aptManRouter