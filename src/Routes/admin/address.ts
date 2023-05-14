import { Router, Request, Response } from 'express'
import { managerAuth, ManagerAuthI } from '../../middleware/auth'
import Address from '../../Models/address.model'
import Master from '../../Models/master'

const AdminRouter = Router()

interface AdminUpdateAddress extends ManagerAuthI {

}

// AdminRouter.post(
// '/initialize_app',
// managerAuth,
// async (req: Request<{ addressId: string }, {}, AdminUpdateAddress>, res: Response) => {
//     try {
//         const { addressId } = req.params
//         const { isAdmin } = req.body

//         //only admins has access to this route
//         if(!isAdmin) {
//             res.status(401).send('not authorized')
//             return
//         }

//         const master = await Master.findOne()

//         if(!master) {
//             const newMaster = new Master({ Apartment_id_index: 0 })
//             newMaster.save()
//                 .then(data => {
//                     res.status(200).send(data)
//                 })
//                 .catch(() => {
//                     res.status(500).send('was not able to create master')
//                 })

//             res.status(200).send('master created')
//             return
//         }

//         res.status(200).send('master already exists')
//     } catch(e) {
//         res.status(400).send(e)
//     }
// })

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