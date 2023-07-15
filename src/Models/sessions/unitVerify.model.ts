import mongoose, { Types, model, Schema, Model } from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcrypt'
import User from '../user.model'
import { generatePassword } from '../../constants/general'
import { sendFirstPassword } from '../../constants/email/setup'

export type UnitVerifySessionDocT = mongoose.Document<unknown, any, UnitVerifySessionI> & UnitVerifySessionI & {
    _id: mongoose.Types.ObjectId
}

export interface UnitVerifySessionI {
    userEmail: string
    userPassword?: string
    createdAt: number
    unitId: string
    unitNum: string
    bldNum: string
    aptName: string
}

interface UnitVerifySessionMethodsI {
    /**
     * @desc: verify user email
     */
    verify<UnitVerifySessionDocT>(): Promise<void>
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
        editable: false
    },
    createdAt: {
        type: Number,
        default: Date.now(),
        editable: false
    },
    unitId: {
        type: String,
        required: true,
        trim: true,
    },
    unitNum: {
        type: String,
    },
    bldNum: {
        type: String,
    },
    aptName: {
        type: String,
    }
})

UnitVerifySessionSchema.methods.verify = async function() {
    const unitVerifySession = this

    const client = await User.findOne({
        email: unitVerifySession.userEmail
    })

    if(!client) {
        throw new Error('Unable to find user')
    }

    if(!client.emailVerified) {
        const newPassword = generatePassword()
        client.emailVerified = true
        client.password = newPassword

        await client.save()

        sendFirstPassword(
            client.email,
            client.firstName,
            newPassword
        )
    }

    client.attachedUnitIds.push(
        unitVerifySession.unitId
    )
    await client.save()
}

const UnitVerifySession = model('UnitVerify', UnitVerifySessionSchema)

export default UnitVerifySession