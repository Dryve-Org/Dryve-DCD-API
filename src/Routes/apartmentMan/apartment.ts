import express, { Request, Response } from 'express'
import Apartment from '../../Models/apartment.model'
import { aptManAuthI, aptManAuth } from '../../middleware/auth'
import { idToString } from '../../constants/general'
import Apt from '../../Models/apartment.model'
import Address from '../../Models/address.model'
import { ClientSelect } from './constant/outputs'
import User from '../../Models/user.model'

const AptR = express.Router()

const getApt = async (aptId: string) => {
    const apt = await Apartment.findById(
        aptId,
        {
            password: 0
        }
    )
    if(!apt) {
        return null
    }

    return apt
}

AptR.get(
'/:aptId',
aptManAuth,
async (req: Request<{aptId: string}, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId } = req.params
        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }

        const apt = await getApt(aptId)
    
        res.send(apt)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})


AptR.get(
'/:aptId/:bldId',
aptManAuth,
async (req: Request<{aptId: string, bldId: string}, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId, bldId } = req.params
        const { aptMan } = req.body

        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }

        const apt = await Apt.findById(aptId, {buildings: 1})
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        const building = apt.getBuilding(bldId)

        const bldAddress = await Address.findById(building.address)
        if(!bldAddress) {
            return res.status(400).send('Invalid building')
        }

        //@ts-ignore
        building.address = bldAddress
    
        res.send(building)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})

AptR.get(
'/:aptId/:bldId/:unitId',
aptManAuth,
async (req: Request<{aptId: string, bldId: string, unitId: string}, {}, aptManAuthI>, res: Response) => {
    try {
        const { aptId, bldId, unitId } = req.params
        const { aptMan } = req.body
        
        if(!idToString(aptMan.attachedApts).includes(aptId)) {
            return res.status(400).send('Unauthorized')
        }
        
        const apt = await Apt.findById(aptId, {
            'buildings': 1
        })
        if(!apt) {
            return res.status(400).send('Invalid apartment')
        }

        const unit = apt.getUnit(bldId, unitId)

        const address = await Address.findById(unit.address)
        if(!address) {
            return res.status(400).send('Invalid unit')
        }

        if (unit.client) {
            const client = await User.findById(unit.client, ClientSelect)
            if(!client) {
                return res.status(400).send('Invalid unit')
            }
            //@ts-ignore
            unit.client = client
        }
        
        res.send(unit)
    } catch(e) {
        res.status(400).send('Invalid inputs')
    }
})


export default AptR