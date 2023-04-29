import mongoose, { Schema, model, Types, Model } from 'mongoose'
import { addClientPreference, incrementApartmentIdIndex, removeClientPreference } from './methods'

export interface ClientPreferenceI {
    title: string
    description: string
    type: 'detergent' | 
        'bleach' | 
        'fabric softener' | 
        'dryer sheets' | 
        'other'
}

export interface MasterI {
    apartment_id_index: number
    /*
        Area services    

        Base this off of ServiceI
    */
    clientPreferences: ClientPreferenceI[]
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

    addClientPreference: (
        title: string, 
        description: string,
        type: ClientPreferenceI['type']
    ) => Promise<MasterI>

    removeClientPreference: (
        id: string | Types.ObjectId
    ) => Promise<MasterI>
}

export type MasterModelT = Model<MasterI, {}, MasterIMethods>

const MasterSchema = new Schema<MasterI, MasterModelT, MasterIMethods> (
    {
        apartment_id_index: {
            type: Number,
            default: 0
        },
        clientPreferences: [
            {
                title: String,
                description: String,
                type: {
                    type: String,
                    enum: [
                        'detergent',
                        'bleach',
                        'fabric softener',
                        'dryer sheets',
                        'other'
                    ]
                }
            }
        ]
    }
)

MasterSchema.method('incrementApartmentIdIndex', incrementApartmentIdIndex)

MasterSchema.method('addClientPreference', addClientPreference)

MasterSchema.method('removeClientPreference', removeClientPreference)


const Master = model<MasterI, MasterModelT>('Master', MasterSchema)

export default Master