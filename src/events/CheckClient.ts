import schedule from 'node-schedule'
import User from '../Models/user.model'
import Apt from '../Models/aparmtent/apartment.model'

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
    tz: 'America/New_York'
}, checkAllSubscriptions)

