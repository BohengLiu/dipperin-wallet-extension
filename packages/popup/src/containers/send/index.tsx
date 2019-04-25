import React from 'react'
import { action, observable, autorun, computed } from 'mobx'
import { observer, inject } from 'mobx-react'
import _ from 'lodash'

import Account from '@/stores/account'
import History from '@/stores/history'
import Transaction from '@/stores/transaction'
import Label from '@/stores/label'

import NavHeader from '@/components/navHeader'
import Modal from '@/components/modal'

import { verifyNumber } from '@/utils'

import './sendStyle.css'

import { APP_STATE, ORIGIN_FEE } from '@dipperin/lib/constants'
import Button from '@/components/button'
import { popupLog as log } from '@dipperin/lib/log'

const { ACCOUNT_PAGE, SETTING_PAGE } = APP_STATE

interface SendProps {
  account?: Account
  history?: History
  transaction?: Transaction
  label?: Label
}

@inject('account', 'history', 'transaction', 'label')
@observer
class Send extends React.Component<SendProps> {
  @observable
  sendToAddress: string = ''

  @observable
  sendAmount: string = ''

  @observable
  minFee: string = String(ORIGIN_FEE)

  @observable
  sendPoundage: string = String(ORIGIN_FEE)

  @observable
  modalHandler = {
    modalMsg: '',
    show: false
  }

  constructor(props) {
    super(props)
    autorun(() => {
      this.getMinFee()
    })
  }

  @computed
  get verifyPoundage() {
    return Number(this.sendPoundage) >= Number(this.minFee)
  }

  @action
  updatePoundage = () => {
    if (!this.verifyPoundage) {
      this.sendPoundage = this.minFee
    }
  }

  @action
  setMinFee = fee => {
    if (Number(fee) > ORIGIN_FEE) {
      this.minFee = fee
    }
  }

  @action
  showMsg = (msg: string, cb?: () => void) => {
    this.modalHandler.modalMsg = msg
    this.modalHandler.show = true
    setTimeout(() => {
      this.modalHandler.modalMsg = ''
      this.modalHandler.show = false
      if (cb) {
        cb()
      }
    }, 2000)
  }

  // verifyNumber = (input: string) => {
  //   const re = /^[0-9.]+$/
  //   return re.test(input)
  // }

  getMinFee = () => {
    if (this.sendToAddress && this.sendAmount) {
      const tx = this.genTx(this.sendToAddress, this.sendAmount)
      // console.log('getMinFee', tx)
      this.props
        .transaction!.getMinTransactionFee(tx)!
        .then((res: string) => {
          log.debug('Send-getMinFee-res:' + res)
          this.setMinFee(res)
          this.updatePoundage()
        })!
        .catch(e => {
          log.error('send-getMinFee-error:' + e)
        })
    }
  }

  turnToAccounnts = () => {
    this.props.history!.historyPush(ACCOUNT_PAGE)
  }

  turnToSettings = () => {
    this.props.history!.historyPush(SETTING_PAGE)
  }

  @action
  handleAddress = e => {
    this.sendToAddress = e.target.value
  }

  @action
  handleAmount = e => {
    if (!verifyNumber(e.target.value)) {
      return
    }
    this.sendAmount = e.target.value
  }

  @action
  handlePoundage = e => {
    if (!verifyNumber(e.target.value)) {
      return
    }
    // console.log('handlePoundage',this.verifyNumber(e.target.value))
    this.sendPoundage = e.target.value
  }

  verifyBalance = () => {
    const accountBalance = this.props.account!.activeAccount.balance
    return Number(accountBalance) >= Number(this.sendPoundage) + Number(this.sendAmount)
  }

  genTx = (address: string, amount: string, fee?: string) => {
    const baseTx = {
      address,
      amount,
      memo: 'from dipperin wallet extension'
    }
    if (fee) {
      return {
        fee,
        ...baseTx
      }
    } else {
      return baseTx
    }
  }

  verifyTx = () => {
    if (!this.sendToAddress) {
      return { success: false, info: this.props.label!.label.extension.send.errorAddress }
    } else if (!this.sendAmount) {
      return { success: false, info: this.props.label!.label.extension.send.errorAmount }
    } else if (!this.sendPoundage) {
      return { success: false, info: this.props.label!.label.extension.send.errorPoundage }
    } else if (!this.verifyBalance()) {
      return { success: false, info: this.props.label!.label.extension.send.errorBalance }
    } else {
      return { success: true }
    }
  }

  translateErrorInfo = (error: string): string => {
    const send = this.props.label!.label.extension.send
    const frequent = [
      'ResponseError: Returned error: "this transaction already in tx pool"',
      'ResponseError: Returned error: "tx nonce is invalid"'
    ]
    if (frequent.includes(error)) {
      return send.errorFrequent
    }
    if (error === 'ResponseError: Returned error: "new fee is too low to replace old one"') {
      return send.lowFee
    }
    return send.errorFrequent
  }

  sendTransfer = async () => {
    const res = this.verifyTx()
    if (res.success) {
      const tx = this.genTx(this.sendToAddress, this.sendAmount, this.sendPoundage)
      try {
        await this.props.transaction!.sendTransaction(tx)
        this.showMsg(this.props.label!.label.extension.send.sendSuccess, this.turnToAccounnts)
      } catch (e) {
        console.log('send-handleTransfer-error:', e)
        this.showMsg(this.translateErrorInfo(e as string))
      }
    } else {
      this.showMsg(res.info as string)
    }
  }

  handleTransfer = _.throttle(this.sendTransfer, 2000)

  render() {
    const activeAccount = this.props.account!.activeAccount
    const btnSend = {
      classes: []
    }
    return (
      <div className="bg-blue">
        <NavHeader />
        <div className="send-content-box">
          <span className="send-close-icon" onClick={this.turnToAccounnts} />
          <div className="send-balance-info">
            <span className="send-balance-title">{this.props.label!.label.extension.send.accountBalance}:</span>
            <span className="send-balance-amount">{` ${activeAccount.balance} DIP`}</span>
          </div>
          <p className="g-input-msg-v1">{this.props.label!.label.extension.send.receinerAddress}</p>
          <input className="g-input-v1" type="text" value={this.sendToAddress} onChange={this.handleAddress} />
          <p className="g-input-msg-v1 send-msg-v1">{this.props.label!.label.extension.send.amount}</p>
          <input className="g-input-v1" type="number" value={this.sendAmount} onChange={this.handleAmount} />
          <p className="g-input-msg-v1 send-msg-v2">
            {this.props.label!.label.extension.send.poundage}{' '}
            <span className="send-reminder">{this.props.label!.label.extension.send.moreThan} 0.00001</span>
          </p>
          <input
            className="g-input-v1"
            type="number"
            value={this.sendPoundage}
            onChange={this.handlePoundage}
            onBlur={this.updatePoundage}
          />
        </div>
        <div className="send-button-box">
          <Button params={btnSend} onClick={this.handleTransfer}>
            {this.props.label!.label.extension.send.send} DIP
          </Button>
        </div>
        <Modal showModal={this.modalHandler.show} size={250}>
          {this.modalHandler.modalMsg}
        </Modal>
      </div>
    )
  }
}

export default Send
