import axios, { AxiosRequestConfig } from "axios";
import qs from "querystring";
import { Service } from "typedi";

import config from "../../config/config.json";

@Service()
export class SMSService {
  public async sendSMS(phoneNumber: string, message: string): Promise<number> {
    const reqOptions: AxiosRequestConfig = {
      method: "get",
      url: "https://sms.ru/sms/send",
      params: {
        api_id: config.sms.api_id,
        to: phoneNumber,
        msg: message,
        json: 1,
      },
      paramsSerializer: (params) => qs.stringify(params),
    };

    try {
      const resp = await axios(reqOptions);
      // Код ответа
      // http://sms.ru/api/status
      return resp.data.status_code;
    } catch (err) {
      throw new Error(err);
    }
  }
}
