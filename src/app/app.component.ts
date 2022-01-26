import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { DataState } from './enum/data.state.enum';
import { AppState } from './interface/app-state';
import { CustomResponse } from './interface/custom-response';
import { ServerService } from './service/server.service';
import { Status } from './enum/status.enum';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { NgForm } from '@angular/forms';
import { Server } from './interface/server';
import { NotificationService } from './service/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {

  appState$ : Observable<AppState<CustomResponse>>;
  readonly DataState = DataState;
  readonly Status = Status;
  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse>(null);
  filterStatus$ = this.filterSubject.asObservable();
  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  constructor (private serverService: ServerService, private notifier: NotificationService) {}

  ngOnInit () : void {
    this.appState$ = this.serverService.servers$.pipe (
      map(response => {
        this.notifier.onDefault(response.message);
        this.dataSubject.next(response);
        return { dataState: DataState.LOADED_STATE, appData: response }
      }),
      startWith({dataState: DataState.LOADING_STATE}),
      catchError((error: string)=> {
        this.notifier.onError(error);
        return of({dataState: DataState.ERROR_STATE,error})
      })
    )
    
  }

  pingServer (ipAddress: string) : void {
    this.filterSubject.next(ipAddress);
    this.appState$ = this.serverService.ping$(ipAddress).pipe (
      map(response => {
        this.notifier.onDefault(response.message);
        const index =  this.dataSubject.value.data.servers.findIndex(server=>server.id === response.data.server.id);
        this.dataSubject.value.data.servers[index] = response.data.server;
        this.filterSubject.next('');
        return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value }
      }),
      startWith({dataState: DataState.LOADED_STATE, appData: this.dataSubject.value}),
      catchError((error: string)=> {
        this.notifier.onError(error);
        this.filterSubject.next('');
        return of({dataState: DataState.ERROR_STATE,error})
      })
    )
    
  }

  deleteServer (server: Server) : void {
    this.appState$ = this.serverService.delete$(server.id).pipe (
      map(response => {
        this.notifier.onDefault(response.message);
        this.dataSubject.next({
          ...response, data:{ servers: this.dataSubject.value.data.servers.filter(s => s.id!==server.id)}
        })
        return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value }
      }),
      startWith({dataState: DataState.LOADED_STATE, appData: this.dataSubject.value}),
      catchError((error: string)=> {
        this.notifier.onError(error);
        return of({dataState: DataState.ERROR_STATE,error})
      })
    )
    
  }

  filterServers (status: Status) : void { 
    // var statuss: Status = Status[status]
    console.log("filtering ----------------" + status)
    this.appState$ = this.serverService.filter$(status,this.dataSubject.value).pipe (
      map(response => {
        this.notifier.onDefault(response.message);
        return { dataState: DataState.LOADED_STATE, appData: response }
      }),
      startWith({dataState: DataState.LOADED_STATE, appData: this.dataSubject.value}),
      catchError((error: string)=> {
        this.notifier.onError(error);
        return of({dataState: DataState.ERROR_STATE,error})
      })
    )
    
  }

  saveServer (serverForm: NgForm) : void { 
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(serverForm.value).pipe (
      map(response => {
        this.notifier.onDefault(response.message);
        this.dataSubject.next({
          ...response, data:{
            servers:[response.data.server,...this.dataSubject.value.data.servers]
          }
        });
        document.getElementById('closeModal').click();
        this.isLoading.next(false)
        serverForm.resetForm({status: this.Status.SERVER_DOWN});
        return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value }
      }),
      startWith({dataState: DataState.LOADED_STATE, appData: this.dataSubject.value}),
      catchError((error: string)=> {
        this.notifier.onError(error);
        this.isLoading.next(false)
        return of({dataState: DataState.ERROR_STATE,error})
      })
    )
  }

  printReport ():void {
    // save as pdf
    // window.print()
    // save as xls 
    let dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    let tableSelect = document.getElementById('servers');
    let tableHtml = tableSelect.outerHTML.replace(/ /g,'%20')
    let downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    downloadLink.href = 'data:' + dataType + ', ' + tableHtml;
    downloadLink.download = 'server-report.xls';
    downloadLink.click();
    document.body.removeChild(downloadLink);
    this.notifier.onDefault("Downloaded");
  }
}
