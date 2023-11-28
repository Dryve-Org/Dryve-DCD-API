import express, {
    Request,
    Response
} from 'express'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import User from '../../Models/user.model'
import bcrypt from 'bcrypt'
import Manager from '../../Models/manager.models'

const ManagerR = express.Router()

interface ManLogin {
    username: string
    password: string
}

/**
 * Logging in manager
 * @param { ManLogin }
*/
ManagerR.post(
'/login',
async (req: Request<{}, {}, ManLogin>, res: Response) => {
    try {
        const genericError = "Invalid email or password"
        const {
            username,
            password
        } = req.body

        //finding user with this email
        const user = await User.findOne({ email: username })
        if(!user) {
            res.status(401).send(genericError)
            return
        }

        //is password valid
        const validPassword = await bcrypt.compare(password, user.password)
        if(!validPassword) {
            res.status(401).send(genericError)
            return
        }

        const manager = await Manager.findOne({
            userId: user._id
        })
        if(!manager) {
            res.status(401).send('not authorized')
            return
        }

        //generating token
        const token = await user.generateAuthToken()

        res.send(token)
    } catch(e) {
        res.status(400).send('invalid inputs')
    }
})

export default ManagerR