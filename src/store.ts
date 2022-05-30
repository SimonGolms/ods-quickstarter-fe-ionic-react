import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist';
import userSlice from './data/user/user.slice';
import { apiMicrosoftGraph } from './services/microsoft-graph/api.microsoftGraph';
import { rtkQueryErrorHandler } from './services/rtkQueryErrorHandler';
import { capacitorStorage } from './utils/capacitorStorage';

const persistConfig = {
  debug: false,
  key: 'root',
  storage: capacitorStorage,
  version: 1,
  whitelist: ['user'],
};

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(rtkQueryErrorHandler)
      .concat(apiMicrosoftGraph.middleware),
  reducer: persistReducer(
    persistConfig,
    combineReducers({
      user: userSlice,
      [apiMicrosoftGraph.reducerPath]: apiMicrosoftGraph.reducer,
    })
  ),
});

export const persistor = persistStore(store);

// Infer the 'AppDispatch' and 'RootState' types from the store itself
type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

// Use throughout your app instead of plain 'useDispatch' and 'useSelector'
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
