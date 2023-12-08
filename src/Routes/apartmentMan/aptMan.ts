import express, { Request, Response } from 'express'
import AptMan from '../../Models/aptMan.model'
import { aptManAuthI, aptManAuth } from '../../middleware/auth'

const AptManRouter = express.Router()

interface AptManLoginI {
    email: string
    password: string
}

AptManRouter.post(
'/login',
async (req: Request<{},{}, AptManLoginI>, res: Response) => {
    try {
        const genericError = "Invalid email or password"
        const { email, password } = req.body

        const aptMan = await AptMan.findOne({ email })
        if(!aptMan) {
            return res.status(400).send(genericError)
        }

        //check password
        //@ts-ignore
        const validPass = await aptMan.comparePassword(password)
        if(!validPass) {
            return res.status(400).send(genericError)
        }
        
        //generate token
        //@ts-ignore
        const token = await aptMan.generateAuthToken()

        res.send({ aptMan, token })
    } catch(e) {
        res.status(400).send('invalid inputs')
    }
})

AptManRouter.get(
'/me',
aptManAuth,
async (req: Request<{}, {}, aptManAuthI>, res: Response) => {
    try {
        const { _id } = req.body

        const aptMan = await AptMan.findById(_id)
            .select({
                password: 0
            })
            .populate([
                {
                    path: 'attachedApts',
                    model: 'Apartment',
                    populate: [
                        {
                            path: 'primaryCleaner',
                            model: 'Cleaner',
                            populate: [
                                {
                                    path: 'address',
                                    model: 'Address'
                                }
                            ],
                            select: {
                                stripeId: 0,
                                activeOrders: 0,
                                orders: 0,
                                cardId: 0,
                                paymentMethod: 0
                            }
                        }
                    ],
                    select: {
                        buildings: 0,
                    }
                }

            ])
        if(!aptMan) {
            return res.status(400).send('unable to get user info')
        }
        
        res.send(aptMan)
    } catch(e) {
        res.status(400).send('unable to get user info')
    }
})

export default AptManRouter