export class ApiResponse {
  public success: boolean = true;
  public data: any;

  constructor(data: any) {
    this.data = data;
  }
}
 