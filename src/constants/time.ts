import moment from 'moment'
import validator from 'validator'

//validate if unix date
export const unixDateFormatter = (value: string): string => { 
    return moment.unix(parseInt(value)).format("MM/DD/YYYY hh:mm a")
}

/**
 * Convert a date string to a unix timestamp
 * @param {string} date - string - The date you want to convert to unix
 * @returns A number
*/
export const dateToUnix = (date: string): number => {
    return moment(date, "YYYY-MM-DD").unix() 
}

/**
 * Convert a unix timestamp to a date string in the format DD/MM/YYYY
 * @param {number} unixDate - number - The unix date you want to convert
 * @returns A function that takes a number and returns a string.
*/
export const unixToDate = (unixDate: number) => {
    const date = moment.unix(unixDate / 1000).format("DD/MM/YYYY")
    return date
}

/**
 * It takes a unix timestamp, converts it to a date string, and then validates that date string
 * @param {number} value - number - The value to be validated
 * @returns A function that takes a number and returns a boolean.
*/
export const isUnixDate = (value: number): boolean => {
    const date = moment.unix(value / 1000).format("YYYY/MM/DD")
    return validator.isDate(date)
}


/**
 * It takes a unix timestamp and returns true if the person is 18 or older
 * @param {number} unixDate - number - The unix timestamp of the date you want to check
 * @returns A function that takes a unixDate and returns a boolean.
*/
export const isOfAge = (unixDate: number): boolean => {
    const date = moment.unix(unixDate).format("MM/DD/YYYY")
    return moment().diff(date, 'years', true) >= 18
}

/**
 * It returns the current time in seconds
 */
export const now = () => moment().unix()