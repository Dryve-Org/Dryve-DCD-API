import mongoose, { Schema, model, Types, Model } from 'mongoose'
<<<<<<< HEAD
import { addClientPreference, incrementApartmentIdIndex, listServices, removeClientPreference } from './methods'
import SAP, { SAPI } from '../ServicesAndProducts'
=======
import { addClientPreference, incrementApartmentIdIndex, removeClientPreference } from './methods'
import { SAPI } from '../ServicesAndProducts'
>>>>>>> 53a8ba7233a169545a0dcd1b7edf2722f6395213

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
    products: {
        name: string
        description: string
        priceId: string
        productId: string
    }
    /*
        Area services    

        Base this off of ServiceI
    */
    clientPreferences: ClientPreferenceI[]
    servicesAndProducts: Types.ObjectId[]
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

<<<<<<< HEAD
    listServices: () => Promise<SAPI['list']>
=======
    /**
     * 
     * @returns {Promise<SAPI['list']>} - list of all services and products
     */
    listAllSAPs: () => Promise<SAPI['list']>
>>>>>>> 53a8ba7233a169545a0dcd1b7edf2722f6395213
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
        ],
        servicesAndProducts: [{
            type: Schema.Types.ObjectId,
            ref: 'ServicesAndProducts',
            default: []
        }]
    }
)

MasterSchema.method('incrementApartmentIdIndex', incrementApartmentIdIndex)

MasterSchema.method('addClientPreference', addClientPreference)

MasterSchema.method('removeClientPreference', removeClientPreference)

MasterSchema.method('listServices', listServices)


const Master = model<MasterI, MasterModelT>('Master', MasterSchema)

export default Master