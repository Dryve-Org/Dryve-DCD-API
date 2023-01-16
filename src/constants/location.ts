import Address, { AddressDocT, AddressI } from "../Models/address.model"
import { Document, Types } from 'mongoose'
import _ from 'lodash'
import { Client, GeocodeResponse, GeocodeResponseData, TravelMode, TravelRestriction, UnitSystem } from "@googlemaps/google-maps-services-js"

export type coordinatesT = [ number, number ]
export const maps = new Client({})

type addyI = Document<unknown, any, AddressI> & AddressI & {
    _id: Types.ObjectId;
}

/*
    this needs to be update
    to not throw entirely.
*/


/**
 * Finds the provided address's placeId and if 
 * place matches a placeId stored in the database
 * the return the follow address document.
 * 
 * If placeId does not match a placeId already stored
 * then create a new address save it and return the
 * new address document.
 * @param {AddressI} address - AddressI,
 * @param [callback] - (address: addyI) => void
 * @returns The address object
*/
export const addAddress = async (
    address: AddressI,
    callback?: (address: addyI) => void
) => {
    const geoData = await geoHandleAddress(address)
        .catch(e => {
            console.error(e)
            throw 'geoHandleAddress failed'
        })
    
    const placeId = geoData.results[0].place_id

    const addyByPlaceId = await Address.findOne({ placeId })
        .catch(e => console.log('error: ', e))
    if(addyByPlaceId) return addyByPlaceId
    
    address.placeId = undefined
    //@ts-ignore
    address._id = undefined

    const addy = new Address(address)

    await addy.save().catch((e) => {
        console.log('add address save error: ', e)
        throw 'was not able to store address'
    })
    if(callback) {
        callback(addy)
    } 

    return addy
}

export const addressToString = (address: AddressI) => `
    ${ address.street_address_line_1 },
    ${ address.street_address_line_2 },
    ${ address.city },
    ${ address.state },
    ${ address.zipcode },
    ${ address.country }
`

export const geoHandleAddress = async (address: AddressI) => {
    const originAddress: GeocodeResponseData = await maps.geocode({
        params: {
            address: addressToString(address),
            key: process.env.GOOGLE_MAP_KEY ? process.env.GOOGLE_MAP_KEY : "null"
        },
    })
    .then(res => res.data)

    return originAddress

}

export const getMiles = (meters: number) => meters*0.000621371192

export const getMeters = (miles: number) => miles*1609.344

const secsToMin = (seconds: number) => (seconds / 60).toFixed(2)

/**
 * It takes two addresses, and returns the distance between them in miles, and the duration in minutes
 * @param {AddressI} origin - {
 * @param {AddressI} destination - {
 * @returns {
 *     distanceInMeters: distanceMatrix.rows[0].elements[0].distance.value, //in meters
 *     durationInSeconds: distanceMatrix.rows[0].elements[0].duration.value, // in seconds
 *     distance: parseFloat(getMiles(distanceMatrix.rows[0].elements[0].distance.
 * }
*/
export const getDistance = async (origin: AddressI, destination: AddressI) => {
    const distanceMatrix = await maps.distancematrix({
        params: {
            origins: [ addressToString(origin) ],
            destinations: [ addressToString(destination) ],
            mode: 'driving' as TravelMode,
            avoid: [ 'tolls' ] as TravelRestriction[],
            units: "imperial" as UnitSystem,
            key: process.env.GOOGLE_MAP_KEY ? process.env.GOOGLE_MAP_KEY : "null"
        }
    }).then(res => res.data)

    const distance = {
        distanceInMeters: distanceMatrix.rows[0].elements[0].distance.value, //in meters
        durationInSeconds: distanceMatrix.rows[0].elements[0].duration.value, // in seconds
        distance: parseFloat(getMiles(distanceMatrix.rows[0].elements[0].distance.value).toFixed(2)),
        duration: parseFloat(secsToMin(distanceMatrix.rows[0].elements[0].duration.value)),
        origin,
        destination
    }

    return distance
}

type IDS = Types.ObjectId | string

/**
 * It takes two address ids, finds the addresses in the database, and then uses the google maps api to
 * calculate the distance between the two addresses
 * @param {IDS} originId - IDS, destinationId: IDS
 * @param {IDS} destinationId - IDS
 * @returns {
 *     distanceInMeters: number, //in meters
 *     durationInSeconds: number, // in seconds
 *     distance: number
 *     duration: number
 *     origin: AddressDocT
 *     destination: AddressDocT
 * }
*/
export const getDistanceById = async (originId: IDS, destinationId: IDS): Promise<{
    distanceInMeters: number, //in meters
    durationInSeconds: number, // in seconds
    distance: number
    duration: number
    origin: AddressDocT
    destination: AddressDocT
}> => {
    const origin = await Address.findById(originId.toString())
    const destination = await Address.findById(destinationId.toString())
    if(!origin || !destination) throw 'unable to calculate distance'

    const distanceMatrix = await maps.distancematrix({
        params: {
            origins: [ addressToString(origin) ],
            destinations: [ addressToString(destination) ],
            mode: 'driving' as TravelMode,
            avoid: [ 'tolls' ] as TravelRestriction[],
            units: "imperial" as UnitSystem,
            key: process.env.GOOGLE_MAP_KEY ? process.env.GOOGLE_MAP_KEY : "null"
        }
    }).then(res => res.data)
    .catch(e => {
        throw {
            codeMessage: 'distance matrix error',
            error: e
        }
    })

    const distance = {
        distanceInMeters: distanceMatrix.rows[0].elements[0].distance.value, //in meters
        durationInSeconds: distanceMatrix.rows[0].elements[0].duration.value, // in seconds
        distance: parseFloat(getMiles(distanceMatrix.rows[0].elements[0].distance.value).toFixed(2)),
        duration: parseFloat(secsToMin(distanceMatrix.rows[0].elements[0].duration.value)),
        origin,
        destination
    }

    return distance
}

//checking if [ latitude, longitude ] is valid
export const validateGeo = (geo: coordinatesT) => {
    return _.inRange(geo[0], -180, 180) && _.inRange(geo[1], -90, 90)
}