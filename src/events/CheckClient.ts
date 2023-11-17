import schedule from 'node-schedule'
import User from '../Models/user.model'

const checkClient = async () => {
    const users = await User.find({})

    for(let i = 0; i < users.length; i++) {
        users[i].checkClientSubcription()
    }
}