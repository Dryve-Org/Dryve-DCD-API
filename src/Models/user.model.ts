import mongoose, { Types, model, Schema, Model } from "mongoose"
import validator from 'validator'
import bcrypt from 'bcrypt'
import { isOfAge, isUnixDate, now } from "../constants/time"
import jwt from 'jsonwebtoken'
import { MongooseFindByReference } from "mongoose-find-by-reference"
import Apt, { UnitI } from "./aparmtent/apartment.model"
import { err, extractUnitId, idToString } from "../constants/general"
import Master, { MasterI } from "./master"
import _ from "lodash"

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

    /**
     *  add preference to client
     * 
     * @param { string[] } clientPreferencesIds
     * @returns { Promise<UserI> }
    */
   addPreferences(
        this: UserDocT,
        clientPreferencesIds: string[]
    ): Promise<UserDocT>

    /**
     *  remove preference to client
     * 
     * @param { string[] } clientPreferencesIds
     * @returns { Promise<UserI> }
    */
    removePreference(
        this: UserDocT,
        clientPreferencesId: string
    ): Promise<UserDocT>
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
    preferences: string[]
}

type UserModelT = Model<UserI, {}, UserIMethods>

const UserSchema = new Schema<UserI, UserModelT, UserIMethods>({
    preferences: [{
        type: String
    }],
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
        
        /**
         * if client is already attached to unitId
         */
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

UserSchema.methods.addPreferences = async function(
    preferenceIds
) {
    const user = this

    const aptIds = user.attachedUnitIds.map(uid => extractUnitId(uid)[0])

    const apts = await Apt.find({ aptId: aptIds })
        .catch(() => {
            throw err(500, 'could not get apartments')
        })
    if(apts.length === 0) {
        throw err(200, 'not attached to an apartment')
    }

    const uniqueMasters = _.uniqBy(apts, 'master')

    const masters = await Master.find({ 
            _id: {$in: uniqueMasters.map(apt => apt.master) }
        },
        { clientPreferences: 1 }
    )
    
    const allPreferences: MasterI['clientPreferences'] = []
    const allPreferencesIds: string[] = []

    masters.forEach(master => {
        allPreferences.push(...master.clientPreferences)

        master.clientPreferences.forEach(cp => {
            //@ts-ignore
            allPreferencesIds.push(cp._id)
        })
    })

    //checking if ids provided exists
    if(
        _.intersection(idToString(allPreferencesIds), preferenceIds).length !== preferenceIds.length 
    ) {
        throw err(400, 'bad data')
    }

    const newPreferences = preferenceIds.filter(pref => {
        if(!user.preferences.includes(pref)) {
            return true
        }
    })

    if(newPreferences.length === 0) {
        return user
    }

    user.preferences.push(...newPreferences)

    await user.save()

    return user
}

UserSchema.methods.removePreference = async function(
    preferenceId
) {
    let user = this
    
    await user.update({
        $pull: {
            preferences: preferenceId
        }
    })

    return user
}
const User = model("User", UserSchema)

export default User