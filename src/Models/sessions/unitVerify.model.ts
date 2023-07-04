import mongoose, { Types, model, Schema, Model } from 'mongoose'
import validator from 'validator'

export type UnitVerifySessionDocT = mongoose.Document<unknown, any, UnitVerifySessionI> & UnitVerifySessionI & {
    _id: mongoose.Types.ObjectId
}

export interface UnitVerifySessionI {
    userEmail: string
    userPassword: string
}

interface UnitVerifySessionMethodsI {

}

type UnitVerifySessionModelT = Model<UnitVerifySessionI, {}, UnitVerifySessionMethodsI>

const UnitVerifySessionSchema = new Schema<
    UnitVerifySessionI,
    UnitVerifySessionModelT,
    UnitVerifySessionMethodsI
>({
    userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate: (value: string) => {
            if (!validator.isEmail(value)) {
                throw new Error('Email is invalid')
            }
        }
    },
    userPassword: {
        type: String,
        required: true,
        editable: false,
        default: () => {
            return '123456'
        }
    }
})

const UnitVerifySession = model('UnitVerify', UnitVerifySessionSchema)

export default UnitVerifySession