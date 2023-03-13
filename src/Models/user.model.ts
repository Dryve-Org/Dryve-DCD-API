import mongoose, { Types, model, Schema, Model } from "mongoose"
import validator from 'validator'
import bcrypt from 'bcrypt'
import { isOfAge, isUnixDate, now } from "../constants/time"
import jwt from 'jsonwebtoken'
import { MongooseFindByReference } from "mongoose-find-by-reference"
import Apt, { UnitI } from "./aparmtent/apartment.model"
import { err, extractUnitId } from "../constants/general"

export type UserDocT = mongoose.Document<unknown, any, UserI> & UserI & {
    _id: mongoose.Types.ObjectId
}

interface UserIMethods {
    /**
     * async function to generate a jwt token for the user
     * @returns { Promise<string> } the jwt token
    */
    generateAuthToken(): Promise<string>

    /**
     * add apartment unit id to the user
     * @param { string } unitId the unit id to add
     * @returns { Promise<void> } the refresh token
    */
    addUnitId(unitId: string): Promise<UserI>

    /**
     * remove apartment unit id to the user
     * @param { string } unitId the unit id to remove
     * @returns { Promise<UserI> } the refresh token
    */
    removeUnitId(unitId: string): Promise<UserI>
}

export interface UserI extends UserIMethods {
    _id?: any
    firstName: string
    lastName: string
    email: string
    password: string
    phoneNumber: string
    dob: number
    address: Types.ObjectId
    pickUpAddresses: Types.ObjectId[]
    stripeId: string
    token?: string
    cards: string[]
    created: number
    refreshToken?: string
    orders: Types.ObjectId[]
    preferredCleaner?: Types.ObjectId 
    pickupAddress?: Types.ObjectId
    preferredCardId: string
    emailVerified: boolean
    attachedUnitIds: string[]
}

type UserModelT = Model<UserI, {}, UserIMethods>

const UserSchema = new Schema<UserI, UserModelT, UserIMethods>({
    firstName: {
        type: String,
        require: true,
        lowercase: true,
    },
    lastName: {
        type: String,
        require: true,
        lowercase: true,
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        validate(value: string){
            if(!validator.isEmail(value)){
                throw new Error('Email is invalid')
            }
        }
    },
    password: {
        type: String,
        minlength: 3,
        trim: true,
        required: true,
        validate(value: string) {
            if(value.toLowerCase().includes('password')){
                throw new Error('password cannot contain "password"')
            }
        }
    },
    phoneNumber: {
        type: String,
        required: true,
        validate(value: string) {
            if(!validator.isMobilePhone(value)) {
                throw new Error("phone number not valid")
            }
        }
    },
    dob: {
        type: Number,
        required: true,
        validate(value: number) {
            if(!isUnixDate(value)) {
                throw new Error("Not in unix format")
            } else if(!isOfAge) {
                throw new Error("User has to be 18 or older")
            }
        }
    },
    stripeId: {
        type: String,
    },
    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    },
    created: {
        type: Number,
        required: true
    },
    pickUpAddresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }],
    cards: [{
        type: String,
    }],
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: []
    }],
    preferredCleaner: {
        type: Schema.Types.ObjectId,
        ref: 'Cleaner'
    },
    pickupAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    },
    preferredCardId: String,
    token: String,
    refreshToken: String,
    emailVerified: Boolean,
    attachedUnitIds: [{
        type: String,
        default: []
    }]
})

UserSchema.plugin(MongooseFindByReference)

UserSchema.methods.generateAuthToken = async function(
    this: UserDocT
) {
    const user = this

    if(!process.env.JWT || !process.env.REFRESHJWT) throw "server error: token"
    const token = jwt.sign(
        {
            _id: user._id.toString()
        }, 
        process.env.JWT,
        { expiresIn: "5d" }
    )

    user.token = token
    user.save()
    return token
}

UserSchema.methods.addUnitId = async function(
    this: UserDocT,
    unitId: string
) {
    try {
        const user = this
    
        if(user.attachedUnitIds.includes(unitId)) return user
    
        const [ aptId ] = extractUnitId(unitId)
    
        const apt = await Apt.findOne({ aptId }, 
            {
                buildings: 1
            }
        )
        if(!apt) throw err(400, 'apartment not found') 
    
        const unitData = apt.getUnitId(unitId)
        if(!unitData) throw err(400, 'unit not found')
    
        const [, , unit] = unitData
        
        if(unit.client?.toString() !== user._id.toString()) {
            throw err(400, 'client is not in this unit')
        }

        user.attachedUnitIds.push(unitId)
    
        await user.update({
            $push: {
                attachedUnitIds: unitId
            }
        })

        return user
    } catch(e: any) {
        if(e.status && e.message) throw e
        console.log(e)
        throw err(500, e)
    }
}

UserSchema.methods.removeUnitId = async function(
    this: UserDocT,
    unitId: string
) {
    try {
        const user = this
    
        if(!user.attachedUnitIds.includes(unitId)) return user
    
        user.attachedUnitIds = user.attachedUnitIds.filter(id => id !== unitId)
    
        await user.update({
            $pull: {
                attachedUnitIds: unitId
            }
        })

        return user
    } catch(e: any) {
        if(e.status && e.message) throw e
        console.log(e)
        throw err(500, e)
    }
}

//edit: this is not done at all
// UserSchema.methods.refreshToken = async function(rToken: string) {
//     const user = this
//     if(!process.env.JWT) throw "server error: token"
//     const token = jwt.sign(
//         {
//             _id: user._id.toString()
//         }, 
//         process.env.JWT,
//         { expiresIn: "7d" }
//     )
//     user.token = token
//     user.save()
//     return token
// }

UserSchema.pre('save', async function (next) { //must use ES5 function to use the "this" binding
    const user = this // "this" is in reverence to userSchema

    if(user.isModified('firstName')) {
        user.firstName = user.firstName.toLowerCase()
    }

    if(user.isModified('lastName')) {
        user.lastName = user.lastName.toLowerCase()
    }

    if(user.isModified('email')) {
        user.email = user.email.toLowerCase()
    }

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }

    if(!user.created) {
        user.created = now()
    }

    if(!user.emailVerified) {
        user.emailVerified = false
    }

    next() // without next the function will hang and never save
})

const User = model("User", UserSchema)

export default User