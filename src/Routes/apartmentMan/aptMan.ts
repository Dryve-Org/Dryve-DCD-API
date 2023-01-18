import express, { Request, Response } from 'express'
import AptMan from '../../Models/aptMan.model'

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

export default AptManRouter