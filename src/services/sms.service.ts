import axios, { AxiosRequestConfig } from "axios";
import config from "config";
import qs from "querystring";
import { Service } from "typedi";

@Service()
export class SMSService {
  public async sendSMS(phoneNumber: string, message: string): Promise<number> {
    const reqOptions: AxiosRequestConfig = {
      method: "get",
      url: "https://sms.ru/sms/send",
      params: {
        api_id: config.get("sms.api_id"),
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
    } catch (error) {
      throw new Error(error);
    }
  }
}
