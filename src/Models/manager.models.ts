import { Schema, model, Types } from 'mongoose'
import validator from 'validator'
import { isUnixDate } from '../constants/time'
import { CardI } from '../interfaces/moneyHandling'

export interface ManagerI {
    userId: Types.ObjectId,
    attachedStores: Types.ObjectId[]
    created: number
    _id: Types.ObjectId
    masters: Types.ObjectId[]
    isAdmin: boolean
}

const ManagerSchema = new Schema<ManagerI>({
    isAdmin: {
        type: Boolean,
        default: false
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attachedStores: [{
        type: Schema.Types.ObjectId,
        ref: 'Cleaner',
        default: []
    }],
    masters: [{
        type: Schema.Types.ObjectId,
        ref: 'Master',
        default: []
    }],
    created: {
        type: Number,
        required: true,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            }
        }
    }
})

const Manager = model('Manager', ManagerSchema)

export default Manager