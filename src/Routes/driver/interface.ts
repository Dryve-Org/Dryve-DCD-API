import { DriverAuthI } from "../../middleware/auth"


export interface GeoDriverI extends DriverAuthI{
    latitude: number
    longitude: number
}