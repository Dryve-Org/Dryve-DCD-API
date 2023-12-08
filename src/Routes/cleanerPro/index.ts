import express, {
    Response,
    Request
} from 'express'
import User from '../../Models/user.model'
import bcrypt from 'bcrypt'
import cleanerR from './cleanerR'
import CleanerProfile from '../../Models/cleanerProfile.model'
import orderR from './order'
import AptR from './aptR'

const cleanerProRouter = express.Router()

cleanerProRouter.use('', cleanerR)
cleanerProRouter.use('', orderR)
cleanerProRouter.use('', AptR)

interface CleanerProLoginI {
    username: string
    password: string
}

/**
 * Cleaner Profile login
*/
cleanerProRouter.post(
'/login',
async (req: Request<{}, {}, CleanerProLoginI>, res: Response) => {
    try {
        const genericError = "Invalid email or password"
        const {
            username,
            password
        } = req.body

        const user = await User.findOne({ email: username })
        if(!user) {
            res.status(401).send(genericError)
            return
        }

        const validPassword = await bcrypt.compare(password, user.password)
        if(!validPassword) {
            res.status(401).send(genericError)
            return
        }

        const cleanerPro = await CleanerProfile.findOne({
            user: { _id: user._id }
        })
        if(!cleanerPro) {
            res.status(401).send('not authorized')
            return
        }

        const token = await user.generateAuthToken()

        res.status(200).send(token)
    } catch(e) {
        res.status(400).send(e)
    }
})

export default cleanerProRouter