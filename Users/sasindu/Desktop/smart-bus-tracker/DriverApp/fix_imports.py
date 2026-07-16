with open('src/screens/DriverHomeScreen.tsx','r') as f:
    content = f.read()

# Fix imports
old_imports = """import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getUserData, logout } from '../../services/auth';
import { getCurrentPosition } from '../../services/location';"""

new_imports = """import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';"""

if old_imports in content:
    content = content.replace(old_imports, new_imports)
    print('Imports replaced successfully!')
else:
    lines = content.split('\n')
    for i in range(17):
        print(f'{i+1}: {repr(lines[i])}')

# Remove router usage - replace with navigation
# First check where router is used
import re
router_usages = [(m.start(), m.group()) for m in re.finditer(r'\brouter\b', content)]
print(f'Found {len(router_usages)} router usages')

with open('src/screens/DriverHomeScreen.tsx','w') as f:
    f.write(content)

print('File saved!')
