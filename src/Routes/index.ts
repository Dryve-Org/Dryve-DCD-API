import cleanerRouter from "./cleaner"
import clientRouter from "./client/index"
import driverRouter from "./driver/index"
import managerRouter from "./manager/index"
// import orderRouter from "./order"
import cleanerProRouter from './cleanerPro'
import AdminRouter from "./admin"
import aptManRouter from "./apartmentMan"

export default {
    clientRouter,
    driverRouter,
    cleanerRouter,
    managerRouter,
    cleanerProRouter,
    AdminRouter,
    aptManRouter
}

