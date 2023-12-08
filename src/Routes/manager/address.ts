import express, { Request, Response } from 'express'
import { managerAuth } from '../../middleware/auth'
import Address from '../../Models/address.model'

const AddyR = express.Router()

AddyR.patch(
'refresh_placeIds',
managerAuth,
async (req: Request, res: Response) => {
    try {
        const addies = await Address.find({})
                
    } catch(e) {
        res.status(500).send(e)
    }
})