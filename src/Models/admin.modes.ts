import { Schema, model, Types } from 'mongoose'

interface AdminI {
    managerId: Types.ObjectId
}

const AdminSchema = new Schema<AdminI>({
    managerId: {
        type: Schema.Types.ObjectId,
        ref: 'Manager',
        required: true,
        unique: true
    }
})

const Admin = model('Admin', AdminSchema)

export default Admin