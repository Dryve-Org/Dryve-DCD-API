import schedule from 'node-schedule'
import Apt from '../Models/aparmtent/apartment.model'

/**
 * The function `checkAllSubscriptions` retrieves all apartments and their buildings, and then iterates
 * through each apartment to check all subscriptions.
*/
export const checkAllSubscriptions = async (): Promise<void> => {
    const apts = await Apt.find({}, { buildings: 1 })

    apts.forEach(async apt => {
        await apt.checkAllSubscriptions()
    })
}

/**
 * This function is called every day at midnight
*/
const everyday = schedule.scheduleJob({
    hour: 0,
    minute: 0,
    second: 0,
    tz: 'America/New_York'
}, checkAllSubscriptions)

