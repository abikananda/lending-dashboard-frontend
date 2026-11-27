import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService, Profile } from '../core/api.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe],
  template: `
    <header><span>ACCOUNT CENTRE</span><h1>Profile & Settings</h1><p>Manage your account identity, portfolio configuration and uploaded data.</p></header>
    @if(profile){
      <section class="identity"><div class="avatar">{{initials(profile.username)}}</div><div><h2>{{profile.username}}</h2><p>{{profile.email}}</p></div><span class="badge">Secure account</span></section>
      <section class="settings-grid">
        <article class="card"><div class="icon lender">ID</div><div class="title"><h3>LenDenClub lender ID</h3><p>Reports must contain this ID in their filename.</p></div><form [formGroup]="lenderForm" (ngSubmit)="saveLenderId()"><label>Lender ID</label><input formControlName="lenderId" placeholder="IAKI7TL1UT6K"><small>Expected: MANUAL_LENDING_REPORT_{{lenderForm.controls.lenderId.value||'YOUR_ID'}}_....xlsx</small><button [disabled]="lenderForm.invalid||savingLender">{{savingLender?'Saving…':'Save lender ID'}}</button></form></article>
        <article class="card"><div class="icon principal">₹</div><div class="title"><h3>Investment principal</h3><p>Your own capital contributed to LenDenClub.</p></div><form [formGroup]="principalForm" (ngSubmit)="savePrincipal()"><label>Principal amount</label><input type="number" min="0" step="100" formControlName="amount"><small>Current: {{profile.investmentPrincipal|currency:'INR':'symbol':'1.0-0'}}</small><button [disabled]="principalForm.invalid||savingPrincipal">{{savingPrincipal?'Saving…':'Update principal'}}</button></form></article>
      </section>
      <article class="danger"><div><span>DANGER ZONE</span><h3>Delete all uploaded data</h3><p>Removes your imported loans, staging rows, wallet transactions, bank credits and reconciliation records. Your account and principal setting are preserved.</p></div><button [disabled]="cleaning" (click)="cleanup()">{{cleaning?'Deleting…':'Delete uploaded data'}}</button></article>
      @if(message){<div class="notice" [class.error]="messageError">{{message}}</div>}
    } @else {<div class="loading">Loading your profile…</div>}
  `,
  styles: [`
    :host{display:block;max-width:1120px;margin:auto;color:#15213b}header span,.danger span{font-size:10px;font-weight:850;letter-spacing:1.6px;color:#4968e8}header h1{font-size:32px;margin:7px 0 5px;letter-spacing:-1px}header p{color:#748096;margin:0 0 26px}.identity{display:flex;align-items:center;gap:15px;background:linear-gradient(125deg,#142652,#254b9b);color:#fff;border-radius:20px;padding:22px 25px;box-shadow:0 14px 35px rgba(30,59,125,.18)}.avatar{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,#5c7cff,#2dd4bf);font-weight:850}.identity h2{font-size:20px;margin:0 0 3px}.identity p{margin:0;color:#c8d5ef;font-size:13px}.badge{margin-left:auto;background:rgba(255,255,255,.13);padding:7px 11px;border-radius:20px;font-size:10px}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}.card{background:#fff;border:1px solid #e7ebf3;border-radius:20px;padding:23px;box-shadow:0 9px 28px rgba(19,42,86,.055)}.icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-weight:850;margin-bottom:15px}.icon.lender{color:#3c5bd5;background:#edf1ff}.icon.principal{color:#079678;background:#e3f8f2}.title h3{font-size:17px;margin:0 0 5px}.title p{font-size:12px;color:#8490a3;margin:0 0 20px}form{display:grid;gap:8px}label{font-size:11px;font-weight:750;color:#41506a}input{height:45px;border:1px solid #dce3ee;border-radius:11px;padding:0 13px;outline:0;font-size:14px}input:focus{border-color:#526fe1;box-shadow:0 0 0 3px #ebefff}small{font-size:10px;color:#8b96a8;overflow-wrap:anywhere}form button{justify-self:start;margin-top:8px;border:0;border-radius:10px;background:#294cb7;color:#fff;padding:10px 15px;font-weight:750}button:disabled{opacity:.55}.danger{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#fff;border:1px solid #ffd8dc;border-radius:20px;padding:22px 24px}.danger span{color:#d33e52}.danger h3{margin:7px 0 5px;font-size:17px}.danger p{color:#7c8799;margin:0;max-width:720px;font-size:12px;line-height:1.55}.danger button{flex:none;border:1px solid #efbec5;border-radius:10px;background:#fff0f1;color:#c63045;padding:11px 15px;font-weight:800}.notice{position:fixed;right:24px;bottom:24px;background:#dff8ef;color:#08765a;border-radius:12px;padding:13px 17px;box-shadow:0 10px 28px rgba(0,0,0,.13)}.notice.error{background:#fff0f1;color:#bd2d40}.loading{padding:60px;text-align:center;color:#748096}@media(max-width:760px){.settings-grid{grid-template-columns:1fr}.danger{align-items:flex-start;flex-direction:column}.identity .badge{display:none}}
  `]
})
export class ProfileComponent {
  private readonly api=inject(ApiService); private readonly fb=inject(FormBuilder);
  profile?:Profile; savingLender=false; savingPrincipal=false; cleaning=false; message=''; messageError=false;
  readonly lenderForm=this.fb.nonNullable.group({lenderId:['',[Validators.required,Validators.pattern(/^[A-Za-z0-9]+$/)]]});
  readonly principalForm=this.fb.nonNullable.group({amount:[0,[Validators.required,Validators.min(0)]]});
  constructor(){this.load();}
  load(){this.api.profile().subscribe({next:p=>{this.profile=p;this.lenderForm.setValue({lenderId:p.lenderId??''});this.principalForm.setValue({amount:p.investmentPrincipal??0});},error:()=>this.show('Unable to load profile.',true)});}
  saveLenderId(){if(this.lenderForm.invalid)return;this.savingLender=true;const lenderId=this.lenderForm.controls.lenderId.value.trim().toUpperCase();this.api.setLenderId(lenderId).pipe(finalize(()=>this.savingLender=false)).subscribe({next:()=>{if(this.profile)this.profile={...this.profile,lenderId};this.lenderForm.setValue({lenderId});this.show('Lender ID saved.');},error:e=>this.show(e.error?.message??'Unable to save lender ID.',true)});}
  savePrincipal(){if(this.principalForm.invalid)return;this.savingPrincipal=true;const amount=Number(this.principalForm.controls.amount.value);this.api.setPrincipal(amount).pipe(finalize(()=>this.savingPrincipal=false)).subscribe({next:()=>{if(this.profile)this.profile={...this.profile,investmentPrincipal:amount};this.show('Investment principal updated.');},error:e=>this.show(e.error?.message??'Unable to update principal.',true)});}
  cleanup(){if(!window.confirm('Delete all uploaded data for your account? This cannot be undone.'))return;this.cleaning=true;this.api.cleanupUploadedData().pipe(finalize(()=>this.cleaning=false)).subscribe({next:r=>this.show(`Cleanup complete: ${r.loansDeleted} loans and ${r.importBatchesDeleted} imports deleted.`),error:e=>this.show(e.error?.message??'Unable to delete uploaded data.',true)});}
  initials(name:string){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
  private show(message:string,error=false){this.message=message;this.messageError=error;window.setTimeout(()=>this.message='',4000);}
}
