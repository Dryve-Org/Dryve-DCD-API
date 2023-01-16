import { Router, Request, Response } from 'express'
import { managerAuth, ManagerAuthI } from '../middleware/auth'
import Address from '../Models/address.model'

const AdminRouter = Router()

interface AdminUpdateAddress extends ManagerAuthI {

}

AdminRouter.put(
'/update_address/:addressId',
managerAuth,
async (req: Request<{ addressId: string }, {}, AdminUpdateAddress>, res: Response) => {
    try {
        const { addressId } = req.params
        const { isAdmin } = req.body

        //only admins has access to this route
        if(!isAdmin) {
            res.status(401).send('not authorized')
            return
        }

        const address = await Address.findById(addressId)
        if(!address) throw 'invalid address'

        address.save()
            .then(data => {
                res.status(200).send(data)
            })
            .catch(() => {
                res.status(500).send('was not able to update addresses')
            })


    } catch(e) {
        res.status(400).send(e)
    }
})

export default AdminRouter