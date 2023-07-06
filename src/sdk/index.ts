import { initDatabaseAPI, workerPromise } from '@/api';
import Emitter from '@/utils/emitter';
import { v4 as uuidv4 } from 'uuid';
import { getGO, initializeWasm, getGoExitPromsie } from './initialize';

import {
  AccessFriendParams,
  AccessGroupParams,
  AccessMessageParams,
  AddFriendParams,
  AdvancedMsgParams,
  AdvancedQuoteMsgParams,
  AtMsgParams,
  ChangeGroupMemberMuteParams,
  ChangeGroupMuteParams,
  CreateGroupParams,
  CustomMsgParams,
  FaceMessageParams,
  FileMsgFullParams,
  FileMsgParams,
  FindMessageParams,
  GetAdvancedHistoryMsgParams,
  GetGroupMemberByTimeParams,
  GetGroupMemberParams,
  GetHistoryMsgParams,
  GetOneConversationParams,
  GetOneCveParams,
  GroupInfoParams,
  ImageMsgParams,
  InitAndLoginConfig,
  InsertGroupMsgParams,
  InsertSingleMsgParams,
  InviteGroupParams,
  isRecvParams,
  JoinGroupParams,
  LocationMsgParams,
  MarkNotiParams,
  MemberExParams,
  MemberNameParams,
  MergerMsgParams,
  PartialUserItem,
  PinCveParams,
  QuoteMsgParams,
  RemarkFriendParams,
  SearchFriendParams,
  SearchGroupMemberParams,
  SearchGroupParams,
  SearchLocalParams,
  SendMsgParams,
  setBurnDurationParams,
  SetDraftParams,
  SetGroupRoleParams,
  SetGroupVerificationParams,
  SetMemberAuthParams,
  SetMessageLocalExParams,
  setPrvParams,
  SoundMsgParams,
  SouondMsgFullParams,
  SplitParams,
  TransferGroupParams,
  TypingUpdateParams,
  VideoMsgFullParams,
  VideoMsgParams,
} from '../types/params';

import { CardElem, IMConfig, WSEvent, WsResponse } from '../types/entity';
import { MessageReceiveOptType } from '@/types/enum';
class SDK extends Emitter {
  private wasmInitializedPromise: Promise<any>;
  private goExitPromise: Promise<void> | undefined;
  private goExisted = false;
  private tryParse = true;
  private isLogStandardOutput = true;

  constructor(url = '/openIM.wasm') {
    super();

    initDatabaseAPI();
    this.wasmInitializedPromise = initializeWasm(url);
    this.goExitPromise = getGoExitPromsie();

    if (this.goExitPromise) {
      this.goExitPromise
        .then(() => {
          console.info('SDK => wasm exist');
        })
        .catch(err => {
          console.info('SDK => wasm with error ', err);
        })
        .finally(() => {
          this.goExisted = true;
        });
    }
  }

  _logWrap(...args: any[]) {
    if (this.isLogStandardOutput) {
      console.info(...args);
    }
  }

  _invoker<T>(
    functionName: string,
    func: (...args: any[]) => Promise<any>,
    args: any[],
    processor?: (data: string) => string
  ): Promise<WsResponse<T>> {
    return new Promise(async (resolve, reject) => {
      this._logWrap(
        `SDK => [OperationID:${
          args[0]
        }] (invoked by js) run ${functionName} with args ${JSON.stringify(
          args
        )}`
      );

      let response = {
        operationID: args[0],
        event: (functionName.slice(0, 1).toUpperCase() +
          functionName.slice(1).toLowerCase()) as any,
      } as WsResponse<T>;
      try {
        if (!getGO() || getGO().exited || this.goExisted) {
          throw 'wasm exist already, fail to run';
        }

        let data = await func(...args);
        if (processor) {
          // this._logWrap(
          //   `SDK => [OperationID:${
          //     args[0]
          //   }] (invoked by js) run ${functionName} with response before processor ${JSON.stringify(
          //     data
          //   )}`
          // );
          data = processor(data);
        }

        if (this.tryParse) {
          try {
            data = JSON.parse(data);
          } catch (error) {
            console.log('SDK => parse error ', error);
          }
        }
        response.data = data;
        resolve(response);
      } catch (error) {
        // this._logWrap(
        //   `SDK => [OperationID:${
        //     args[0]
        //   }] (invoked by js) run ${functionName} with error ${JSON.stringify(
        //     error
        //   )}`
        // );
        response = {
          ...response,
          ...(error as WsResponse<T>),
        };
        reject(response);
      }

      // this._logWrap(
      //   `SDK => [OperationID:${
      //     args[0]
      //   }] (invoked by js) run ${functionName} with response ${JSON.stringify(
      //     response
      //   )}`
      // );

      // return response as WsResponse;
    });
  }
  login = async (params: InitAndLoginConfig, operationID = uuidv4()) => {
    this._logWrap(
      `SDK => (invoked by js) run login with args ${JSON.stringify({
        params,
        operationID,
      })}`
    );

    await workerPromise;
    await this.wasmInitializedPromise;
    window.commonEventFunc(event => {
      try {
        console.info('SDK => received event ', event);
        const parsed = JSON.parse(event) as WSEvent;

        this.emit(parsed.event, parsed);
      } catch (error) {
        console.error(error);
      }
    });

    const config: IMConfig = {
      platformID: params.platformID,
      apiAddr: params.apiAddr,
      wsAddr: params.wsAddr,
      dataDir: './',
      logLevel: params.logLevel || 6,
      isLogStandardOutput: params.isLogStandardOutput || true,
      logFilePath: './',
      isExternalExtensions: params.isExternalExtensions || false,
    };
    this.tryParse = params.tryParse ?? true;
    this.isLogStandardOutput = config.isLogStandardOutput;
    window.initSDK(operationID, JSON.stringify(config));
    return await window.login(operationID, params.userID, params.token);
  };
  logout = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('logout', window.logout, [operationID]);
  };
  getAllConversationList = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getAllConversationList',
      window.getAllConversationList,
      [operationID]
    );
  };
  getOneConversation = <T>(
    params: GetOneConversationParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('getOneConversation', window.getOneConversation, [
      operationID,
      params.sessionType,
      params.sourceID,
    ]);
  };
  getAdvancedHistoryMessageList = <T>(
    params: GetAdvancedHistoryMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getAdvancedHistoryMessageList',
      window.getAdvancedHistoryMessageList,
      [operationID, JSON.stringify(params)]
    );
  };
  getAdvancedHistoryMessageListReverse = <T>(
    params: GetAdvancedHistoryMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getAdvancedHistoryMessageListReverse',
      window.getAdvancedHistoryMessageListReverse,
      [operationID, JSON.stringify(params)]
    );
  };
  getSpecifiedGroupsInfo = <T>(params: string[], operationID = uuidv4()) => {
    return this._invoker<T>(
      'getSpecifiedGroupsInfo',
      window.getSpecifiedGroupsInfo,
      [operationID, JSON.stringify(params)]
    );
  };
  deleteConversationAndDeleteAllMsg = <T>(
    conversationID: string,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'deleteConversationAndDeleteAllMsg',
      window.deleteConversationAndDeleteAllMsg,
      [operationID, conversationID]
    );
  };
  markConversationMessageAsRead = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>(
      'markConversationMessageAsRead',
      window.markConversationMessageAsRead,
      [operationID, data]
    );
  };
  markMessagesAsReadByMsgID = <T>(
    params: MarkNotiParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'markMessagesAsReadByMsgID',
      window.markMessagesAsReadByMsgID,
      [operationID, params.conversationID, JSON.stringify(params.msgIDList)]
    );
  };
  getGroupMemberList = <T>(
    params: GetGroupMemberParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('getGroupMemberList', window.getGroupMemberList, [
      operationID,
      params.groupID,
      params.filter,
      params.offset,
      params.count,
    ]);
  };
  createTextMessage = <T>(text: string, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createTextMessage',
      window.createTextMessage,
      [operationID, text],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createImageMessage = <T>(params: ImageMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createImageMessage',
      window.createImageMessageByURL,
      [
        operationID,
        JSON.stringify(params.sourcePicture),
        JSON.stringify(params.bigPicture),
        JSON.stringify(params.snapshotPicture),
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createCustomMessage = <T>(
    params: CustomMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createCustomMessage',
      window.createCustomMessage,
      [operationID, params.data, params.extension, params.description],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createQuoteMessage = <T>(params: QuoteMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createQuoteMessage',
      window.createQuoteMessage,
      [operationID, params.text, params.message],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createAdvancedQuoteMessage = <T>(
    params: AdvancedQuoteMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createAdvancedQuoteMessage',
      window.createAdvancedQuoteMessage,
      [
        operationID,
        params.text,
        params.message,
        JSON.stringify(params.messageEntityList),
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createAdvancedTextMessage = <T>(
    params: AdvancedMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createAdvancedTextMessage',
      window.createAdvancedTextMessage,
      [operationID, params.text, JSON.stringify(params.messageEntityList)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  sendMessage = <T>(params: SendMsgParams, operationID = uuidv4()) => {
    const offlinePushInfo = params.offlinePushInfo ?? {
      title: '你有一条新消息',
      desc: '',
      ex: '',
      iOSPushSound: '+1',
      iOSBadgeCount: true,
    };
    return this._invoker<T>('sendMessage', window.sendMessage, [
      operationID,
      params.message,
      params.recvID,
      params.groupID,
      JSON.stringify(offlinePushInfo),
    ]);
  };
  sendMessageNotOss = <T>(params: SendMsgParams, operationID = uuidv4()) => {
    const offlinePushInfo = params.offlinePushInfo ?? {
      title: '你有一条新消息',
      desc: '',
      ex: '',
      iOSPushSound: '+1',
      iOSBadgeCount: true,
    };
    return this._invoker<T>('sendMessageNotOss', window.sendMessageNotOss, [
      operationID,
      params.message,
      params.recvID,
      params.groupID,
      JSON.stringify(offlinePushInfo),
    ]);
  };
  sendMessageByBuffer = <T>(params: SendMsgParams, operationID = uuidv4()) => {
    const offlinePushInfo = params.offlinePushInfo ?? {
      title: '你有一条新消息',
      desc: '',
      ex: '',
      iOSPushSound: '+1',
      iOSBadgeCount: true,
    };
    return this._invoker<T>('sendMessageByBuffer', window.sendMessageByBuffer, [
      operationID,
      params.message,
      params.recvID,
      params.groupID,
      JSON.stringify(offlinePushInfo),
      params.fileArrayBuffer,
      params.snpFileArrayBuffer,
    ]);
  };

  setMessageLocalEx = <T>(
    params: SetMessageLocalExParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('setMessageLocalEx', window.setMessageLocalEx, [
      operationID,
      params.conversationID,
      params.clientMsgID,
      params.localEx,
    ]);
  };

  exportDB(operationID = uuidv4()) {
    return this._invoker('exportDB', window.exportDB, [operationID]);
  }

  getHistoryMessageListReverse = <T>(
    params: GetHistoryMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getHistoryMessageListReverse',
      window.getHistoryMessageListReverse,
      [operationID, JSON.stringify(params)]
    );
  };

  revokeMessage = <T>(data: AccessMessageParams, operationID = uuidv4()) => {
    return this._invoker<T>('revokeMessage', window.revokeMessage, [
      operationID,
      data.conversationID,
      data.clientMsgID,
    ]);
  };

  setConversationPrivateChat = <T>(
    params: setPrvParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setConversationPrivateChat',
      window.setConversationPrivateChat,
      [operationID, params.conversationID, params.isPrivate]
    );
  };

  setConversationBurnDuration = <T>(
    params: setBurnDurationParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setConversationBurnDuration',
      window.setConversationBurnDuration,
      [operationID, params.conversationID, params.burnDuration]
    );
  };

  getLoginStatus = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getLoginStatus',
      window.getLoginStatus,
      [operationID],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  setAppBackgroundStatus = <T>(data: boolean, operationID = uuidv4()) => {
    return this._invoker<T>(
      'setAppBackgroundStatus',
      window.setAppBackgroundStatus,
      [operationID, data]
    );
  };

  networkStatusChanged = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'networkStatusChanged ',
      window.networkStatusChanged,
      [operationID]
    );
  };

  getLoginUser = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('getLoginUser', window.getLoginUser, [operationID]);
  };

  getSelfUserInfo = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('getSelfUserInfo', window.getSelfUserInfo, [
      operationID,
    ]);
  };

  getUsersInfo = <T>(data: string[], operationID = uuidv4()) => {
    return this._invoker<T>('getUsersInfo', window.getUsersInfo, [
      operationID,
      JSON.stringify(data),
    ]);
  };

  setSelfInfo = <T>(data: PartialUserItem, operationID = uuidv4()) => {
    return this._invoker<T>('setSelfInfo', window.setSelfInfo, [
      operationID,
      JSON.stringify(data),
    ]);
  };

  createTextAtMessage = <T>(data: AtMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createTextAtMessage',
      window.createTextAtMessage,
      [
        operationID,
        data.text,
        JSON.stringify(data.atUserIDList),
        JSON.stringify(data.atUsersInfo),
        data.message,
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };
  createSoundMessage = <T>(data: SoundMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createSoundMessage',
      window.createSoundMessageByURL,
      [operationID, JSON.stringify(data)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createVideoMessage = <T>(data: VideoMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createVideoMessage',
      window.createVideoMessageByURL,
      [operationID, JSON.stringify(data)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createFileMessage = <T>(data: FileMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createFileMessage',
      window.createFileMessageByURL,
      [operationID, JSON.stringify(data)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createFileMessageFromFullPath = <T>(
    data: FileMsgFullParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createFileMessageFromFullPath',
      window.createFileMessageFromFullPath,
      [operationID, data.fileFullPath, data.fileName],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createImageMessageFromFullPath = <T>(
    data: string,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createImageMessageFromFullPath ',
      window.createImageMessageFromFullPath,
      [operationID, data],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createSoundMessageFromFullPath = <T>(
    data: SouondMsgFullParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createSoundMessageFromFullPath ',
      window.createSoundMessageFromFullPath,
      [operationID, data.soundPath, data.duration],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createVideoMessageFromFullPath = <T>(
    data: VideoMsgFullParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createVideoMessageFromFullPath ',
      window.createVideoMessageFromFullPath,
      [
        operationID,
        data.videoFullPath,
        data.videoType,
        data.duration,
        data.snapshotFullPath,
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createMergerMessage = <T>(data: MergerMsgParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createMergerMessage ',
      window.createMergerMessage,
      [
        operationID,
        JSON.stringify(data.messageList),
        data.title,
        JSON.stringify(data.summaryList),
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createForwardMessage = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createForwardMessage ',
      window.createForwardMessage,
      [operationID, data],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createFaceMessage = <T>(data: FaceMessageParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createFaceMessage ',
      window.createFaceMessage,
      [operationID, data.index, data.data],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createLocationMessage = <T>(
    data: LocationMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'createLocationMessage ',
      window.createLocationMessage,
      [operationID, data.description, data.longitude, data.latitude],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  createCardMessage = <T>(data: CardElem, operationID = uuidv4()) => {
    return this._invoker<T>(
      'createCardMessage ',
      window.createCardMessage,
      [operationID, JSON.stringify(data)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  };

  deleteMessageFromLocalStorage = <T>(
    data: AccessMessageParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'deleteMessageFromLocalStorage ',
      window.deleteMessageFromLocalStorage,
      [operationID, data.conversationID, data.clientMsgID]
    );
  };

  deleteMessage = <T>(data: AccessMessageParams, operationID = uuidv4()) => {
    return this._invoker<T>('deleteMessage ', window.deleteMessage, [
      operationID,
      data.conversationID,
      data.clientMsgID,
    ]);
  };

  deleteAllConversationFromLocal = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'deleteAllConversationFromLocal ',
      window.deleteAllConversationFromLocal,
      [operationID]
    );
  };

  deleteAllMsgFromLocal = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'deleteAllMsgFromLocal ',
      window.deleteAllMsgFromLocal,
      [operationID]
    );
  };

  deleteAllMsgFromLocalAndSvr = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'deleteAllMsgFromLocalAndSvr ',
      window.deleteAllMsgFromLocalAndSvr,
      [operationID]
    );
  };

  insertSingleMessageToLocalStorage = <T>(
    data: InsertSingleMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'insertSingleMessageToLocalStorage ',
      window.insertSingleMessageToLocalStorage,
      [operationID, data.message, data.recvID, data.sendID]
    );
  };

  insertGroupMessageToLocalStorage = <T>(
    data: InsertGroupMsgParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'insertGroupMessageToLocalStorage ',
      window.insertGroupMessageToLocalStorage,
      [operationID, data.message, data.groupID, data.sendID]
    );
  };
  typingStatusUpdate = <T>(
    data: TypingUpdateParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('typingStatusUpdate ', window.typingStatusUpdate, [
      operationID,
      data.recvID,
      data.msgTip,
    ]);
  };
  clearConversationAndDeleteAllMsg = <T>(
    data: string,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'clearConversationAndDeleteAllMsg ',
      window.clearConversationAndDeleteAllMsg,
      [operationID, data]
    );
  };
  getConversationListSplit = <T>(data: SplitParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'getConversationListSplit ',
      window.getConversationListSplit,
      [operationID, data.offset, data.count]
    );
  };
  getConversationIDBySessionType = <T>(
    data: GetOneCveParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getConversationIDBySessionType ',
      window.getConversationIDBySessionType,
      [operationID, data.sourceID, data.sessionType]
    );
  };

  getMultipleConversation = <T>(data: string[], operationID = uuidv4()) => {
    return this._invoker<T>(
      'getMultipleConversation ',
      window.getMultipleConversation,
      [operationID, JSON.stringify(data)]
    );
  };

  deleteConversation = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('deleteConversation ', window.deleteConversation, [
      operationID,
      data,
    ]);
  };

  setConversationDraft = <T>(data: SetDraftParams, operationID = uuidv4()) => {
    return this._invoker<T>(
      'setConversationDraft ',
      window.setConversationDraft,
      [operationID, data.conversationID, data.draftText]
    );
  };

  pinConversation = <T>(data: PinCveParams, operationID = uuidv4()) => {
    return this._invoker<T>('pinConversation ', window.pinConversation, [
      operationID,
      data.conversationID,
      data.isPinned,
    ]);
  };
  getTotalUnreadMsgCount = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getTotalUnreadMsgCount ',
      window.getTotalUnreadMsgCount,
      [operationID]
    );
  };
  getConversationRecvMessageOpt = <T>(
    data: string[],
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getConversationRecvMessageOpt ',
      window.getConversationRecvMessageOpt,
      [operationID, JSON.stringify(data)]
    );
  };
  setConversationRecvMessageOpt = <T>(
    data: isRecvParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setConversationRecvMessageOpt ',
      window.setConversationRecvMessageOpt,
      [operationID, data.conversationID, data.opt]
    );
  };
  searchLocalMessages = <T>(
    data: SearchLocalParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'searchLocalMessages ',
      window.searchLocalMessages,
      [operationID, JSON.stringify(data)]
    );
  };
  addFriend = <T>(data: AddFriendParams, operationID = uuidv4()) => {
    return this._invoker<T>('addFriend ', window.addFriend, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  searchFriends = <T>(data: SearchFriendParams, operationID = uuidv4()) => {
    return this._invoker<T>('searchFriends ', window.searchFriends, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  getSpecifiedFriendsInfo = <T>(data: string[], operationID = uuidv4()) => {
    return this._invoker<T>(
      'getSpecifiedFriendsInfo ',
      window.getSpecifiedFriendsInfo,
      [operationID, JSON.stringify(data)]
    );
  };
  getFriendApplicationListAsRecipient = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getFriendApplicationListAsRecipient ',
      window.getFriendApplicationListAsRecipient,
      [operationID]
    );
  };
  getFriendApplicationListAsApplicant = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getFriendApplicationListAsApplicant ',
      window.getFriendApplicationListAsApplicant,
      [operationID]
    );
  };
  getFriendList = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('getFriendList ', window.getFriendList, [
      operationID,
    ]);
  };
  setFriendRemark = <T>(data: RemarkFriendParams, operationID = uuidv4()) => {
    return this._invoker<T>('setFriendRemark ', window.setFriendRemark, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  checkFriend = <T>(data: string[], operationID = uuidv4()) => {
    return this._invoker<T>('checkFriend', window.checkFriend, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  acceptFriendApplication = <T>(
    data: AccessFriendParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'acceptFriendApplication',
      window.acceptFriendApplication,
      [operationID, JSON.stringify(data)]
    );
  };
  refuseFriendApplication = <T>(
    data: AccessFriendParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'refuseFriendApplication ',
      window.refuseFriendApplication,
      [operationID, JSON.stringify(data)]
    );
  };
  deleteFriend = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('deleteFriend ', window.deleteFriend, [
      operationID,
      data,
    ]);
  };
  addBlack = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('addBlack ', window.addBlack, [operationID, data]);
  };
  removeBlack = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('removeBlack ', window.removeBlack, [
      operationID,
      data,
    ]);
  };
  getBlackList = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('getBlackList ', window.getBlackList, [
      operationID,
    ]);
  };
  inviteUserToGroup = <T>(data: InviteGroupParams, operationID = uuidv4()) => {
    return this._invoker<T>('inviteUserToGroup ', window.inviteUserToGroup, [
      operationID,
      data.groupID,
      data.reason,
      JSON.stringify(data.userIDList),
    ]);
  };
  kickGroupMember = <T>(data: InviteGroupParams, operationID = uuidv4()) => {
    return this._invoker<T>('kickGroupMember ', window.kickGroupMember, [
      operationID,
      data.groupID,
      data.reason,
      JSON.stringify(data.userIDList),
    ]);
  };
  isJoinGroup = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('isJoinGroup ', window.isJoinGroup, [
      operationID,
      data,
    ]);
  };

  getSpecifiedGroupMembersInfo = <T>(
    data: Omit<InviteGroupParams, 'reason'>,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getSpecifiedGroupMembersInfo ',
      window.getSpecifiedGroupMembersInfo,
      [operationID, data.groupID, JSON.stringify(data.userIDList)]
    );
  };
  getGroupMemberListByJoinTimeFilter = <T>(
    data: GetGroupMemberByTimeParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'getGroupMemberListByJoinTimeFilter ',
      window.getGroupMemberListByJoinTimeFilter,
      [
        operationID,
        data.groupID,
        data.offset,
        data.count,
        data.joinTimeBegin,
        data.joinTimeEnd,
        JSON.stringify(data.filterUserIDList),
      ]
    );
  };
  searchGroupMembers = <T>(
    data: SearchGroupMemberParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('searchGroupMembers ', window.searchGroupMembers, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  setGroupApplyMemberFriend = <T>(
    data: SetMemberAuthParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGroupApplyMemberFriend ',
      window.setGroupApplyMemberFriend,
      [operationID, data.groupID, data.rule]
    );
  };
  setGroupLookMemberInfo = <T>(
    data: SetMemberAuthParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGroupLookMemberInfo ',
      window.setGroupLookMemberInfo,
      [operationID, data.groupID, data.rule]
    );
  };
  getJoinedGroupList = <T>(operationID = uuidv4()) => {
    return this._invoker<T>('getJoinedGroupList ', window.getJoinedGroupList, [
      operationID,
    ]);
  };
  createGroup = <T>(data: CreateGroupParams, operationID = uuidv4()) => {
    return this._invoker<T>('createGroup ', window.createGroup, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  setGroupInfo = <T>(data: GroupInfoParams, operationID = uuidv4()) => {
    return this._invoker<T>('setGroupInfo ', window.setGroupInfo, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  setGroupMemberNickname = <T>(
    data: MemberNameParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGroupMemberNickname ',
      window.setGroupMemberNickname,
      [operationID, data.groupID, data.userID, data.groupMemberNickname]
    );
  };
  setGroupMemberInfo = <T>(data: MemberExParams, operationID = uuidv4()) => {
    return this._invoker<T>('setGroupMemberInfo ', window.setGroupMemberInfo, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  joinGroup = <T>(data: JoinGroupParams, operationID = uuidv4()) => {
    return this._invoker<T>('joinGroup ', window.joinGroup, [
      operationID,
      data.groupID,
      data.reqMsg,
      data.joinSource,
    ]);
  };
  searchGroups = <T>(data: SearchGroupParams, operationID = uuidv4()) => {
    return this._invoker<T>('searchGroups ', window.searchGroups, [
      operationID,
      JSON.stringify(data),
    ]);
  };
  quitGroup = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('quitGroup ', window.quitGroup, [
      operationID,
      data,
    ]);
  };
  dismissGroup = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>('dismissGroup ', window.dismissGroup, [
      operationID,
      data,
    ]);
  };
  changeGroupMute = <T>(
    data: ChangeGroupMuteParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('changeGroupMute ', window.changeGroupMute, [
      operationID,
      data.groupID,
      data.isMute,
    ]);
  };
  changeGroupMemberMute = <T>(
    data: ChangeGroupMemberMuteParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'changeGroupMemberMute ',
      window.changeGroupMemberMute,
      [operationID, data.groupID, data.userID, data.mutedSeconds]
    );
  };
  transferGroupOwner = <T>(
    data: TransferGroupParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>('transferGroupOwner ', window.transferGroupOwner, [
      operationID,
      data.groupID,
      data.newOwnerUserID,
    ]);
  };
  getGroupApplicationListAsApplicant = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getGroupApplicationListAsApplicant ',
      window.getGroupApplicationListAsApplicant,
      [operationID]
    );
  };
  getGroupApplicationListAsRecipient = <T>(operationID = uuidv4()) => {
    return this._invoker<T>(
      'getGroupApplicationListAsRecipient ',
      window.getGroupApplicationListAsRecipient,
      [operationID]
    );
  };
  acceptGroupApplication = <T>(
    data: AccessGroupParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'acceptGroupApplication ',
      window.acceptGroupApplication,
      [operationID, data.groupID, data.fromUserID, data.handleMsg]
    );
  };
  refuseGroupApplication = <T>(
    data: AccessGroupParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'refuseGroupApplication ',
      window.refuseGroupApplication,
      [operationID, data.groupID, data.fromUserID, data.handleMsg]
    );
  };
  resetConversationGroupAtType = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>(
      'resetConversationGroupAtType ',
      window.resetConversationGroupAtType,
      [operationID, data]
    );
  };
  setGroupMemberRoleLevel = <T>(
    data: SetGroupRoleParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGroupMemberRoleLevel ',
      window.setGroupMemberRoleLevel,
      [operationID, data.groupID, data.userID, data.roleLevel]
    );
  };
  setGroupVerification = <T>(
    data: SetGroupVerificationParams,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGroupVerification ',
      window.setGroupVerification,
      [operationID, data.groupID, data.verification]
    );
  };
  getGroupMemberOwnerAndAdmin = <T>(data: string, operationID = uuidv4()) => {
    return this._invoker<T>(
      'getGroupMemberOwnerAndAdmin ',
      window.getGroupMemberOwnerAndAdmin,
      [operationID, data]
    );
  };
  setGlobalRecvMessageOpt = <T>(
    opt: MessageReceiveOptType,
    operationID = uuidv4()
  ) => {
    return this._invoker<T>(
      'setGlobalRecvMessageOpt ',
      window.setGlobalRecvMessageOpt,
      [operationID, opt]
    );
  };
  findMessageList = <T>(data: FindMessageParams, operationID = uuidv4()) => {
    return this._invoker<T>('findMessageList ', window.findMessageList, [
      operationID,
      JSON.stringify(data),
    ]);
  };
}

let instance: SDK;

export function getSDK(url = '/openIM.wasm'): SDK {
  if (typeof window === 'undefined') {
    return {} as SDK;
  }

  if (instance) {
    return instance;
  }

  instance = new SDK(url);

  return instance;
}
