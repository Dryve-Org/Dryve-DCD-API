import { Schema, model, Types, Document } from 'mongoose'
import validator from 'validator'
import { isUnixDate, now } from '../constants/time'
import { CardI } from '../interfaces/moneyHandling'

export type CleanerProT = Document<unknown, any, CleanerProfileI> & CleanerProfileI & {
    _id: Types.ObjectId;
}

export interface CleanerProfileI {
    _id: Types.ObjectId
    user: Types.ObjectId,
    attachedCleaners: Types.ObjectId[]
    created: number
    ownerOf?: Types.ObjectId[]
    storePaymentMethod: string
}

const CleanerProfileSchema = new Schema<CleanerProfileI>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attachedCleaners: [{
        type: Schema.Types.ObjectId,
        ref: 'Cleaner',
    }],
    created: {
        type: Number,
        required: true,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    },
    ownerOf: [{
        type: Schema.Types.ObjectId,
        ref: 'Cleaner',
        default: []
    }],
    storePaymentMethod: {
        Type: String
    }
})

CleanerProfileSchema.pre('save', async function (next) { //must use ES5 function to use the "this" binding
    const cleanerPro = this // "this" is in reverence to userSchema

    if (!cleanerPro.created) {
        cleanerPro.created = now()
    }

    next() // without next the function will hang and never save
})

const CleanerProfile = model('CleanerProfile', CleanerProfileSchema)

export default CleanerProfile