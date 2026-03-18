import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

type Props = {
    onExport: () => void;
    onImport: () => void;
    onRestoreDefaults: () => void;
};

export default function HeaderMenu({ onExport, onImport, onRestoreDefaults }: Props) {

    const router = useRouter();
    const [open, setOpen] = useState(false);

    return (
        <View style={{ marginRight: 10 }}>

            <Pressable onPress={() => setOpen(true)}>
                <MaterialIcons name="more-vert" size={24} />
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >

                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setOpen(false)}
                >

                    <View style={styles.menu}>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setOpen(false);
                                router.push("/add-practice");
                            }}
                        >
                            <Text>Add Practice</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setOpen(false);
                                onExport();
                            }}
                        >
                            <Text>Export Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setOpen(false);
                                onImport();
                            }}
                        >
                            <Text>Import Backup</Text>
                        </Pressable>

                        <Pressable
                            style={styles.item}
                            onPress={() => {
                                setOpen(false);
                                onRestoreDefaults();
                            }}
                        >
                            <Text style={styles.destructiveText}>Restore Defaults</Text>
                        </Pressable>

                    </View>

                </TouchableOpacity>

            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({

    overlay: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-end",
        paddingTop: 55,
        paddingRight: 6,
        backgroundColor: "rgba(0,0,0,0.1)"
    },

    menu: {
        backgroundColor: "white",
        borderRadius: 6,
        paddingVertical: 10,
        width: 180,
        elevation: 5,
        marginTop: 4
    },

    item: {
        paddingVertical: 10,
        paddingHorizontal: 15
    },

    destructiveText: {
        color: "#c62828"
    }

});