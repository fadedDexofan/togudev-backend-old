import axios, { AxiosRequestConfig } from "axios";
import config from "config";
import qs from "querystring";
import { Service } from "typedi";

@Service()
export class SMSService {
  public async sendSMS(phoneNumber: string, message: string) {
    const reqOptions: AxiosRequestConfig = {
      method: "get",
      url: "https://sms.ru/sms/send",
      params: {
        api_id: config.get("sms.api_id"),
        to: phoneNumber,
        // from: config.get("sms.from"),
        msg: message,
        json: 1,
      },
      paramsSerializer: (params) => qs.stringify(params),
    };

    try {
      const resp = await axios(reqOptions);
      // Код успеха
      if (resp.data.status_code === 100) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw new Error(error);
    }
  }
}
