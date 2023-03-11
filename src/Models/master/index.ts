import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { incrementApartmentIdIndex } from './methods'

export interface MasterI {
    apartment_id_index: number
}

export type MasterDocT = mongoose.Document<unknown, any, MasterI> & MasterI & {
    _id: mongoose.Types.ObjectId
}


interface MasterIMethods {
    /**
     * increment apartment id index
     * @return {Promise<MasterI>} - updated master document
     */
    incrementApartmentIdIndex: () => Promise<MasterI>
}

export type MasterModelT = Model<MasterI, {}, MasterIMethods>

const MasterSchema = new Schema<MasterI, MasterModelT, MasterIMethods> (
    {
        apartment_id_index: {
            type: Number,
            default: 0
        }
    }
)

MasterSchema.method('incrementApartmentIdIndex', incrementApartmentIdIndex)

const Master = model<MasterI, MasterModelT>('Master', MasterSchema)

export default Master